from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from build_his_restore_sql import (
    TABLE_PREFIX,
    appointment_rows,
    location_rows,
    masterdata_rows,
    organization_rows,
    patient_rows,
    service_and_drug_rows,
    vaccine_rows,
    visit_rows,
)


ROOT = Path(__file__).resolve().parents[1]
MAIN_JS = ROOT / "src" / "main.js"
BATCH_SIZE = 100


def load_supabase_config() -> tuple[str, str]:
    text = MAIN_JS.read_text(encoding="utf-8")
    url = re.search(r'SUPABASE_URL = "([^"]+)', text)
    key = re.search(r'SUPABASE_ANON_KEY = "([^"]+)', text)
    if not url or not key:
        raise RuntimeError("Could not read Supabase URL/key from src/main.js")
    return url.group(1), key.group(1)


def request_json(method: str, url: str, key: str, body: Any | None = None) -> tuple[int, str]:
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def endpoint(base_url: str, table: str, query: str = "") -> str:
    encoded_table = urllib.parse.quote(table, safe="")
    return f"{base_url}/rest/v1/{encoded_table}{query}"


def table_name(base: str) -> str:
    return f"{TABLE_PREFIX}{base}"


def delete_table(base_url: str, key: str, table: str, filter_col: str) -> None:
    url = endpoint(base_url, table, f"?{urllib.parse.quote(filter_col)}=not.is.null")
    status, body = request_json("DELETE", url, key)
    if status in {200, 204}:
        print(f"cleaned {table}")
        return
    if status == 404:
        print(f"skip clean {table}: table not found")
        return
    raise RuntimeError(f"failed cleaning {table}: HTTP {status} {body}")


def upsert_rows(base_url: str, key: str, table: str, rows: list[dict[str, Any]], conflict_cols: list[str]) -> None:
    if not rows:
        return
    query = "?on_conflict=" + urllib.parse.quote(",".join(conflict_cols))
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        status, body = request_json("POST", endpoint(base_url, table, query), key, batch)
        if status not in {200, 201, 204}:
            raise RuntimeError(f"failed importing {table} rows {start + 1}-{start + len(batch)}: HTTP {status} {body}")
        print(f"imported {table}: {min(start + len(batch), len(rows))}/{len(rows)}")
        time.sleep(0.05)


def build_payloads() -> list[tuple[str, list[dict[str, Any]], list[str], str]]:
    patients, patient_categories = patient_rows()
    visits, visit_categories = visit_rows()
    appointments, appointment_statuses = appointment_rows()
    organizations = organization_rows()
    services, drugs = service_and_drug_rows()
    locations = location_rows(patients)
    vaccines, patient_vaccines = vaccine_rows()
    masterdata = masterdata_rows({**patient_categories, **visit_categories, "Appointment_Status": appointment_statuses})

    admin_hash = hashlib.sha256("admin123".encode("utf-8")).hexdigest()
    users = [
        {
            "Name": "Admin",
            "Email": "admin@his-sys.com",
            "Password": admin_hash,
            "Password_Hash": admin_hash,
            "Role": "admin",
            "Permissions": "all",
            "ButtonPermissions": {},
            "Status": "active",
        }
    ]
    settings = [
        {"Key": "HospitalName", "Value": "One Medical Clinic"},
        {"Key": "LogoUrl", "Value": ""},
        {"Key": "OpdHeaderUrl", "Value": ""},
        {"Key": "OpdFooterUrl", "Value": ""},
    ]
    wards = [{"Ward_ID": "WARD001", "Ward_Name": "General Ward", "Department": "IPD", "Floor": "1", "Capacity": 4, "Status": "Active", "Notes": "Default ward"}]
    rooms = [{"Room_ID": "ROOM001", "Ward_ID": "WARD001", "Room_Number": "101", "Room_Type": "General", "Capacity": 4, "Status": "Available", "Notes": "Default room"}]
    beds = [{"Bed_ID": f"BED{i:03d}", "Room_ID": "ROOM001", "Ward_ID": "WARD001", "Bed_Number": str(i), "Status": "Available", "Notes": None} for i in range(1, 5)]

    return [
        ("Users", users, ["Email"], "Email"),
        ("Settings", settings, ["Key"], "Key"),
        ("Patients", patients, ["Patient_ID"], "Patient_ID"),
        ("Visits", visits, ["Import_Key"], "Import_Key"),
        ("Appointments", appointments, ["Appt_ID"], "Appt_ID"),
        ("Organizations", organizations, ["Org_ID"], "Org_ID"),
        ("Service_Lists", services, ["ID"], "ID"),
        ("Locations", locations, ["ID"], "ID"),
        ("MasterData", masterdata, ["Category", "Value"], "Category"),
        ("Drugs_Master", drugs, ["Drug_ID"], "Drug_ID"),
        ("Vaccines_Master", vaccines, ["Vac_ID"], "Vac_ID"),
        ("Patient_Vaccines", patient_vaccines, ["Record_ID"], "Record_ID"),
        ("Wards", wards, ["Ward_ID"], "Ward_ID"),
        ("Rooms", rooms, ["Room_ID"], "Room_ID"),
        ("Beds", beds, ["Bed_ID"], "Bed_ID"),
    ]


def main() -> int:
    base_url, key = load_supabase_config()
    payloads = build_payloads()

    print("Cleaning old unprefixed and prefixed HIS data...")
    for base, _rows, _conflict, filter_col in reversed(payloads):
        delete_table(base_url, key, table_name(base), filter_col)
    for base, _rows, _conflict, filter_col in reversed(payloads):
        delete_table(base_url, key, base, filter_col)

    print("Importing clean HIS_One_ data...")
    for base, rows, conflict_cols, _filter_col in payloads:
        upsert_rows(base_url, key, table_name(base), rows, conflict_cols)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
