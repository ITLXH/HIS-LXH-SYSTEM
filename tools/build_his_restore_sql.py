from __future__ import annotations

import json
import math
import re
import hashlib
from collections import OrderedDict
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = Path(r"C:\Users\asus\Downloads\OMC Registration.xlsx")
OUTPUT = ROOT / "supabase" / "his_restore_from_omc_registration.sql"
TABLE_PREFIX = "HIS_One_"


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    if pd.isna(value):
        return True
    return str(value).strip() == ""


def clean(value: Any) -> str | None:
    if is_blank(value):
        return None
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return None
        if value.hour or value.minute or value.second:
            return value.strftime("%Y-%m-%d %H:%M:%S")
        return value.strftime("%Y-%m-%d")
    if hasattr(value, "isoformat") and not isinstance(value, str):
        try:
            text = value.isoformat()
            return text[:10] if re.match(r"^\d{4}-\d{2}-\d{2}T00:00:00", text) else text
        except Exception:
            pass
    text = str(value).strip()
    if text.lower() in {"nan", "nat", "none", "<na>"}:
        return None
    if text.endswith(".0") and re.fullmatch(r"-?\d+\.0", text):
        return text[:-2]
    return text


def clean_int(value: Any) -> int | None:
    text = clean(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except Exception:
        return None


def sql_value(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, int):
        return str(value)
    text = clean(value)
    if text is None:
        return "NULL"
    return "'" + text.replace("'", "''") + "'"


def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def table_ref(name: str) -> str:
    prefixed_name = f"{TABLE_PREFIX}{name}"
    return f"public.{qident(prefixed_name)}"


def read_sheet(name: str) -> pd.DataFrame:
    return pd.read_excel(WORKBOOK, sheet_name=name, dtype=object).dropna(how="all")


def nonempty_values(df: pd.DataFrame, column: str) -> list[str]:
    if column not in df.columns:
        return []
    seen: OrderedDict[str, None] = OrderedDict()
    for item in df[column].tolist():
        value = clean(item)
        if value:
            seen[value] = None
    return list(seen.keys())


def add_unique(items: OrderedDict[str, None], value: Any) -> None:
    text = clean(value)
    if text:
        items[text] = None


def rows_to_insert_sql(table: str, rows: list[dict[str, Any]], conflict_cols: list[str] | None = None) -> str:
    if not rows:
        return ""
    columns = list(rows[0].keys())
    chunks: list[str] = []
    for start in range(0, len(rows), 10):
        batch = rows[start : start + 200]
        values = []
        for row in batch:
            values.append("(" + ", ".join(sql_value(row.get(col)) for col in columns) + ")")
        stmt = [
            f"INSERT INTO {table_ref(table)} ({', '.join(qident(c) for c in columns)}) VALUES",
            ",\n".join(values),
        ]
        if conflict_cols:
            update_cols = [c for c in columns if c not in conflict_cols]
            if update_cols:
                assignments = ", ".join(f"{qident(c)} = EXCLUDED.{qident(c)}" for c in update_cols)
                stmt.append(f"ON CONFLICT ({', '.join(qident(c) for c in conflict_cols)}) DO UPDATE SET {assignments};")
            else:
                stmt.append(f"ON CONFLICT ({', '.join(qident(c) for c in conflict_cols)}) DO NOTHING;")
        else:
            stmt.append(";")
        chunks.append("\n".join(stmt))
    return "\n\n".join(chunks)


def table_sql(name: str, columns: OrderedDict[str, str], primary_key: str | None = None) -> str:
    defs = []
    for col, typ in columns.items():
        suffix = " PRIMARY KEY" if primary_key == col else ""
        defs.append(f"  {qident(col)} {typ}{suffix}")
    sql = [f"CREATE TABLE IF NOT EXISTS {table_ref(name)} (\n" + ",\n".join(defs) + "\n);"]
    for col, typ in columns.items():
        sql.append(f"ALTER TABLE {table_ref(name)} ADD COLUMN IF NOT EXISTS {qident(col)} {typ};")
    return "\n".join(sql)


def rls_sql(name: str) -> str:
    policy = f"anon_all_{name}"
    return f"""
ALTER TABLE {table_ref(name)} ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS {qident(policy)} ON {table_ref(name)};
CREATE POLICY {qident(policy)} ON {table_ref(name)} FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON TABLE {table_ref(name)} TO anon, authenticated;
"""


def patient_rows() -> tuple[list[dict[str, Any]], dict[str, OrderedDict[str, None]]]:
    category_values: dict[str, OrderedDict[str, None]] = {
        key: OrderedDict()
        for key in ["Title", "Gender", "Nationality", "Occupation", "BloodType", "Shift", "Channel", "InsCompany"]
    }
    rows_by_id: OrderedDict[str, dict[str, Any]] = OrderedDict()
    for sheet in ["Old Patients", "Registration"]:
        df = read_sheet(sheet)
        for _, r in df.iterrows():
            patient_id = clean(r.get("Patient_ID"))
            if not patient_id:
                continue
            age = clean_int(r.get("Age"))
            age_group = clean(r.get("ຊ່ວງອາຍຸ"))
            if age is not None and not age_group:
                age_group = "0-15" if age <= 15 else "16-35" if age <= 35 else "36-55" if age <= 55 else "55+"
            row = {
                "Patient_ID": patient_id,
                "Title": clean(r.get("Title")),
                "First_Name": clean(r.get("First_Name")),
                "Last_Name": clean(r.get("Last_Name")),
                "Gender": clean(r.get("Gender")),
                "Date_of_Birth": clean(r.get("Date_of_Birth (DD/MM/YYYY)")),
                "Age": age,
                "Nationality": clean(r.get("nationality")),
                "Occupation": clean(r.get("occupation")),
                "Blood_Type": clean(r.get("Blood_Type")),
                "Phone_Number": clean(r.get("Phone_Number")),
                "Email": clean(r.get("Email")),
                "Address": clean(r.get("Address")),
                "District": clean(r.get("District")),
                "Province": clean(r.get("Province")),
                "Organization_ID": clean(r.get("Organization_ID")),
                "Name_Org": clean(r.get("Name_Org")),
                "Insurance_Company": None,
                "Insurance_Code": clean(r.get("Insurance Code")),
                "Insured_Person_Name": clean(r.get("Insured Person Name")),
                "Drug_Allergy": clean(r.get("Drug_Allergy")),
                "Underlying_Disease": clean(r.get("Underlying_Disease")),
                "Emergency_Name": clean(r.get("Emergency_Name")),
                "Emergency_Contact": clean(r.get("Emergency_Contact")),
                "Emergency_Relation": clean(r.get("Emergency_Relation")),
                "Channel": clean(r.get("ຊ່ອງທາງທີ່ຮູ້ຈັກຄີນິກ")),
                "Registration_Date": clean(r.get("Registration_Date")),
                "Time": clean(r.get("ເວລາ")),
                "Shift": clean(r.get("ກະເຊົ້າ - ກະແລງ")),
                "Age_Group": age_group,
                "Photo_URL": None,
            }
            rows_by_id[patient_id] = row
            add_unique(category_values["Title"], row["Title"])
            add_unique(category_values["Gender"], row["Gender"])
            add_unique(category_values["Nationality"], row["Nationality"])
            add_unique(category_values["Occupation"], row["Occupation"])
            add_unique(category_values["BloodType"], row["Blood_Type"])
            add_unique(category_values["Shift"], row["Shift"])
            add_unique(category_values["Channel"], row["Channel"])
    return list(rows_by_id.values()), category_values


def visit_rows() -> tuple[list[dict[str, Any]], dict[str, OrderedDict[str, None]]]:
    vitals = read_sheet("Vital Signs")
    vital_by_id: dict[str, pd.Series] = {}
    for _, v in vitals.iterrows():
        vital_id = clean(v.get("Vital_ID"))
        if vital_id:
            vital_by_id[vital_id] = v

    categories = {key: OrderedDict() for key in ["Department", "Doctor", "Visit_Type", "Visit_Status", "Site"]}
    rows: list[dict[str, Any]] = []
    visits = read_sheet("Visits")
    for import_index, (_, r) in enumerate(visits.iterrows(), start=1):
        visit_id = clean(r.get("Visit_ID"))
        if not visit_id or visit_id == "#REF!":
            visit_id = f"VSIMP{import_index:06d}"
        v = vital_by_id.get(clean(r.get("Vital_ID")) or "", pd.Series(dtype=object))
        systolic = clean(v.get("BP_Systolic"))
        diastolic = clean(v.get("BP_Diastolic"))
        bp = f"{systolic}/{diastolic}" if systolic and diastolic else None
        status = clean(r.get("Visit_Status")) or "Completed"
        site = clean(r.get("In-site")) or clean(r.get("Onsite"))
        doctor = clean(r.get("Doctor"))
        row = {
            "Import_Key": f"VISIT-IMPORT-{import_index:06d}",
            "Visit_ID": visit_id,
            "Vital_ID": clean(r.get("Vital_ID")),
            "Date": clean(r.get("Visit_Date")),
            "Time": clean(r.get("Visit_Time")),
            "Patient_ID": clean(r.get("Patient_ID")),
            "Patient_Name": clean(r.get("Patient_Name")),
            "Age": clean_int(r.get("Age")),
            "Gender": clean(r.get("Gender")),
            "Site": site,
            "In_Site": clean(r.get("In-site")),
            "Onsite": clean(r.get("Onsite")),
            "Visit_Type": clean(r.get("Visit_Type")),
            "Chief_Complaint": clean(r.get("Chief_Complaint")) or clean(v.get("Chief_Complaint")),
            "Symptoms": clean(r.get("Chief_Complaint")) or clean(v.get("Chief_Complaint")),
            "BP": bp,
            "Temp": clean(v.get("Temperature_C")),
            "Weight": clean(v.get("Weight_kg")),
            "Height": clean(v.get("Height_cm")),
            "Pulse": clean(v.get("Pulse_bpm")),
            "SpO2": clean(v.get("O2_Saturation")),
            "BP_Systolic": systolic,
            "BP_Diastolic": diastolic,
            "Respiratory_Rate": clean(v.get("Respiratory_Rate")),
            "O2_Saturation": clean(v.get("O2_Saturation")),
            "Pain_Score": clean(v.get("Pain_Score")),
            "BMI": clean(v.get("BMI")),
            "BMI_Status": clean(v.get("BMI_Status")),
            "Revenue_Group": clean(r.get("Revenue Group")),
            "Mapped_Specialist": clean(r.get("Mapped Specialist Services")),
            "Services_List": clean(r.get("Services_List")),
            "Diagnosis": clean(r.get("Diagnosis")),
            "Treatment": clean(r.get("Treatment")),
            "Follow_Up_Date": clean(r.get("Follow_Up_Date")),
            "Status": status,
            "Recorded_By": clean(r.get("Recorded_By")) or clean(v.get("Recorded_By")),
            "Doctor": doctor,
            "Doctor_Name": doctor,
            "Department": clean(r.get("Department")) or clean(v.get("ພະແນກ")),
            "Notes": clean(r.get("Notes")) or clean(v.get("Notes")),
            "Appointment_ID": clean(r.get("Appointment_ID")),
            "Shift": clean(r.get("ກະເຊົ້າ - ກະແລງ")),
            "Visit_Date": clean(r.get("Visit_Date")),
            "Visit_Time": clean(r.get("Visit_Time")),
            "Prescription_JSON": None,
            "Lab_Orders_JSON": None,
            "Discharge_Status": status,
            "Physical_Exam": None,
            "Advice": None,
            "Follow_Up": clean(r.get("Follow_Up_Date")),
        }
        rows.append(row)
        add_unique(categories["Department"], row["Department"])
        add_unique(categories["Doctor"], row["Doctor_Name"])
        add_unique(categories["Visit_Type"], row["Visit_Type"])
        add_unique(categories["Visit_Status"], row["Status"])
        add_unique(categories["Site"], row["Site"])
    return rows, categories


def appointment_rows() -> tuple[list[dict[str, Any]], OrderedDict[str, None]]:
    statuses: OrderedDict[str, None] = OrderedDict()
    rows: OrderedDict[str, dict[str, Any]] = OrderedDict()
    df = read_sheet("Appointments")
    for _, r in df.iterrows():
        appt_id = clean(r.get("Appointment_ID")) or f"APPT{len(rows)+1:05d}"
        status = clean(r.get("Status")) or "Waiting"
        row = {
            "Appt_ID": appt_id,
            "Appointment_ID": appt_id,
            "Target_ID": clean(r.get("Patient_ID")),
            "Target_Name": clean(r.get("Patient_Name")),
            "Patient_ID": clean(r.get("Patient_ID")),
            "Patient_Name": clean(r.get("Patient_Name")),
            "Appt_Date": clean(r.get("Appointment_Date")),
            "Appt_Time": clean(r.get("Appointment_Time")),
            "Type": clean(r.get("Appointment_Type")) or "General",
            "Reason": clean(r.get("Notes")) or clean(r.get("Department")),
            "Doctor": clean(r.get("Doctor_Name")),
            "Doctor_Name": clean(r.get("Doctor_Name")),
            "Status": status,
            "Created_Date": clean(r.get("Created_Date")),
            "Created_By": clean(r.get("Created_By")),
            "Updated_Date": clean(r.get("Updated_Date")),
            "Department": clean(r.get("Department")),
            "Contact_Number": clean(r.get("Contact_Number")),
            "Notes": clean(r.get("Notes")),
        }
        rows[appt_id] = row
        add_unique(statuses, status)
    return list(rows.values()), statuses


def organization_rows() -> list[dict[str, Any]]:
    rows: OrderedDict[str, dict[str, Any]] = OrderedDict()
    corp = read_sheet("Data Master corporate ID")
    for i, r in corp.iterrows():
        org_code = clean(r.get("Org Code"))
        key = org_code or clean(r.get("Customer ID Example")) or f"ORG{i+1:05d}"
        rows[key] = {
            "Org_ID": key,
            "Cus_ID_Ex": clean(r.get("Customer ID Example")),
            "Name": clean(r.get("Name")),
            "Org_Name": clean(r.get("Organization Name")),
            "Org_Code": org_code,
            "Discount": clean(r.get("Discount detail")),
            "Status": clean(r.get("Status")) or "Active",
            "Organization_ID": org_code,
            "Organization_Name": clean(r.get("Organization Name")),
            "Patient_ID": None,
            "Title": None,
            "First_Name": None,
            "Last_Name": None,
            "Gender": None,
            "Date_of_Birth": None,
            "Age": None,
            "Family_Member": None,
            "Discount_Detail": clean(r.get("Discount detail")),
        }
    org_sheet = read_sheet("Organizations")
    for i, r in org_sheet.iterrows():
        key = clean(r.get("Organization_ID")) or f"ORG-SHEET-{i+1:04d}"
        rows[key] = {
            "Org_ID": key,
            "Cus_ID_Ex": clean(r.get("Patient_ID")),
            "Name": clean(r.get("Name")),
            "Org_Name": clean(r.get("Organization_Name")),
            "Org_Code": key,
            "Discount": clean(r.get("Discount_Detail")),
            "Status": clean(r.get("Status")) or "Active",
            "Organization_ID": key,
            "Organization_Name": clean(r.get("Organization_Name")),
            "Patient_ID": clean(r.get("Patient_ID")),
            "Title": clean(r.get("Title")),
            "First_Name": clean(r.get("First_Name")),
            "Last_Name": clean(r.get("Last_Name")),
            "Gender": clean(r.get("Gender")),
            "Date_of_Birth": clean(r.get("Date_of_Birth")),
            "Age": clean_int(r.get("Age")),
            "Family_Member": clean(r.get("Family_Member")),
            "Discount_Detail": clean(r.get("Discount_Detail")),
        }
    return list(rows.values())


def service_and_drug_rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    services: list[dict[str, Any]] = []
    drugs: OrderedDict[str, dict[str, Any]] = OrderedDict()
    df = read_sheet("Service_Lists")
    for i, r in df.iterrows():
        service = clean(r.get("Services_List"))
        medicine = clean(r.get("Medicine"))
        if service:
            services.append(
                {
                    "ID": f"SRV{i+1:05d}",
                    "Services_List": service,
                    "Mapped_Specialist": clean(r.get("Mapped Specialist Services")),
                    "Revenue_Group": clean(r.get("Revenue Group")),
                    "Medicine": medicine,
                    "unit": clean(r.get("unit")),
                    "Usage": clean(r.get("ວິທີການກີນ")),
                    "Note": clean(r.get("ໝາຍເຫດ")),
                }
            )
        if medicine and medicine not in drugs:
            desc = ", ".join(filter(None, [clean(r.get("unit")), clean(r.get("ວິທີການກີນ")), clean(r.get("ໝາຍເຫດ"))]))
            drugs[medicine] = {"Drug_ID": f"DRUG{len(drugs)+1:05d}", "Drug_Name": medicine, "Description": desc or None}
    return services, list(drugs.values())


def location_rows(patient_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pairs: OrderedDict[tuple[str, str], None] = OrderedDict()
    lists = read_sheet("Lists")
    district_col = "ເມືືອງ"
    province_col = "ແຂວງ"
    for _, r in lists.iterrows():
        d = clean(r.get(district_col))
        p = clean(r.get(province_col))
        if d:
            pairs[(d, p or "")] = None
    for row in patient_data:
        d = clean(row.get("District"))
        p = clean(row.get("Province"))
        if d:
            pairs[(d, p or "")] = None
    return [{"ID": f"LOC{i+1:05d}", "District": d, "Province": p or None} for i, (d, p) in enumerate(pairs.keys())]


def vaccine_rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    master: OrderedDict[str, dict[str, Any]] = OrderedDict()
    df = read_sheet("Vaccination")
    for i, r in df.iterrows():
        patient_id = clean(r.get("Patient_ID"))
        patient_name = clean(r.get("Full_Name"))
        vaccine = clean(r.get("Name_Vaccine"))
        if not patient_id or not vaccine:
            continue
        max_dose = 1
        for dose in range(1, 6):
            lot = clean(r.get(f"Lot No{dose}"))
            date_col = f"ວັນທີສັກຄັ້ງທີ {dose}"
            date_given = clean(r.get(date_col))
            given_by = clean(r.get(f"ແພດຜູ້ນັດ/ສັກ {dose}"))
            status = clean(r.get(f"Status{dose}"))
            next_date = clean(r.get(f"ມື້ນັດຄັ້ງທີ {dose + 1}")) if dose < 5 else None
            if lot or date_given or status:
                max_dose = max(max_dose, dose)
                records.append(
                    {
                        "Record_ID": f"PVAC{i+1:04d}-{dose}",
                        "Patient_ID": patient_id,
                        "Patient_Name": patient_name,
                        "Vaccine_Name": vaccine,
                        "Dose_Number": dose,
                        "Lot_Number": lot,
                        "Date_Given": date_given,
                        "Next_Appointment_Date": next_date,
                        "Next_Due_Date": next_date,
                        "Given_By": given_by,
                        "Status": status,
                        "Notes": clean(r.get("Note")),
                    }
                )
        if vaccine not in master:
            master[vaccine] = {
                "Vac_ID": f"VAC{len(master)+1:04d}",
                "Vaccine_Name": vaccine,
                "Disease": None,
                "Disease_Target": None,
                "Total_Doses": max_dose,
                "Interval_Days": None,
                "Dose_Interval": None,
            }
        else:
            master[vaccine]["Total_Doses"] = max(master[vaccine]["Total_Doses"] or 1, max_dose)
    return list(master.values()), records


def masterdata_rows(*category_maps: dict[str, OrderedDict[str, None]]) -> list[dict[str, Any]]:
    combined: dict[str, OrderedDict[str, None]] = OrderedDict()
    for cmap in category_maps:
        for cat, values in cmap.items():
            combined.setdefault(cat, OrderedDict())
            for value in values:
                combined[cat][value] = None

    lists = read_sheet("Lists")
    list_map = {
        "Gender": "Gender",
        "Blood_Type": "BloodType",
        "Title": "Title",
        "Visit_Type": "Visit_Type",
        "Visit_Status": "Visit_Status",
        "Department": "Department",
        "Appointment_Status": "Appointment_Status",
        "ເວລາເຂົ້າໃຊ້ບໍລິການ": "Shift",
        "ປະເພດການບໍລິການ": "PatientType_InSite",
        "ລາວ": "Nationality",
        "ທິບພະຍະ": "InsCompany",
        "ພາຍໃນ": "Site",
        "Name_Vaccine": "Vaccine_Name",
    }
    for source, category in list_map.items():
        if source in lists.columns:
            combined.setdefault(category, OrderedDict())
            for value in nonempty_values(lists, source):
                combined[category][value] = None

    fallback = {
        "Site": ["In-site", "Onsite"],
        "Status": ["Active", "Inactive"],
        "Appointment_Status": ["Waiting", "Completed", "Cancelled", "Missed", "Overdue"],
    }
    for cat, values in fallback.items():
        combined.setdefault(cat, OrderedDict())
        for value in values:
            combined[cat][value] = None

    rows: list[dict[str, Any]] = []
    for category, values in combined.items():
        for value in values:
            rows.append({"Category": category, "Value": value})
    return rows


def build_sql() -> str:
    patients, patient_categories = patient_rows()
    visits, visit_categories = visit_rows()
    appointments, appointment_statuses = appointment_rows()
    organizations = organization_rows()
    services, drugs = service_and_drug_rows()
    locations = location_rows(patients)
    vaccines, patient_vaccines = vaccine_rows()
    master_categories = {**patient_categories, **visit_categories, "Appointment_Status": appointment_statuses}
    masterdata = masterdata_rows(master_categories)

    tables: list[tuple[str, OrderedDict[str, str], str | None]] = [
        ("Patients", OrderedDict((c, "INTEGER" if c == "Age" else "TEXT") for c in patients[0].keys()) | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Patient_ID"),
        (
            "Visits",
            OrderedDict({"Row_ID": "BIGINT GENERATED BY DEFAULT AS IDENTITY"})
            | OrderedDict((c, "INTEGER" if c == "Age" else "TEXT") for c in visits[0].keys())
            | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}),
            "Row_ID",
        ),
        ("Appointments", OrderedDict((c, "TEXT") for c in appointments[0].keys()) | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Appt_ID"),
        ("Organizations", OrderedDict((c, "INTEGER" if c == "Age" else "TEXT") for c in organizations[0].keys()) | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Org_ID"),
        ("Service_Lists", OrderedDict((c, "TEXT") for c in services[0].keys()) | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "ID"),
        ("Locations", OrderedDict((c, "TEXT") for c in locations[0].keys()) | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "ID"),
        ("MasterData", OrderedDict({"ID": "BIGINT GENERATED BY DEFAULT AS IDENTITY", "Category": "TEXT", "Value": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "ID"),
        ("Drugs_Master", OrderedDict((c, "TEXT") for c in drugs[0].keys()) | OrderedDict({"Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Drug_ID"),
        ("Labs_Master", OrderedDict({"Lab_ID": "TEXT", "Lab_Name": "TEXT", "Description": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Lab_ID"),
        ("Vaccines_Master", OrderedDict({"Vac_ID": "TEXT", "Vaccine_Name": "TEXT", "Disease": "TEXT", "Disease_Target": "TEXT", "Total_Doses": "INTEGER", "Interval_Days": "TEXT", "Dose_Interval": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Vac_ID"),
        ("Patient_Vaccines", OrderedDict({"Record_ID": "TEXT", "Patient_ID": "TEXT", "Patient_Name": "TEXT", "Vaccine_Name": "TEXT", "Dose_Number": "INTEGER", "Lot_Number": "TEXT", "Date_Given": "TEXT", "Next_Appointment_Date": "TEXT", "Next_Due_Date": "TEXT", "Given_By": "TEXT", "Status": "TEXT", "Notes": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Record_ID"),
        ("Users", OrderedDict({"ID": "BIGINT GENERATED BY DEFAULT AS IDENTITY", "Name": "TEXT", "Email": "TEXT UNIQUE", "Password": "TEXT", "Password_Hash": "TEXT", "Role": "TEXT", "Permissions": "TEXT", "ButtonPermissions": "JSONB DEFAULT '{}'::jsonb", "Status": "TEXT DEFAULT 'active'", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "ID"),
        ("Settings", OrderedDict({"Key": "TEXT", "Value": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Key"),
        ("activity_logs", OrderedDict({"id": "BIGINT GENERATED BY DEFAULT AS IDENTITY", "timestamp": "TIMESTAMPTZ", "user_id": "TEXT", "user_name": "TEXT", "action": "TEXT", "details": "TEXT", "module": "TEXT"}), "id"),
        ("Admissions", OrderedDict({"Admission_ID": "TEXT", "Patient_ID": "TEXT", "Patient_Name": "TEXT", "Admission_Date": "TEXT", "Admission_Time": "TEXT", "Admission_Type": "TEXT", "Admitting_Doctor": "TEXT", "Diagnosis_Admission": "TEXT", "Ward_ID": "TEXT", "Room_ID": "TEXT", "Bed_ID": "TEXT", "Deposit_Amount": "NUMERIC", "Insurance_Info": "TEXT", "Status": "TEXT DEFAULT 'Admitted'", "Discharge_Date": "TEXT", "Discharge_Time": "TEXT", "Discharge_Status": "TEXT", "Discharge_Diagnosis": "TEXT", "Notes": "TEXT", "Follow_Up_Date": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Admission_ID"),
        ("Wards", OrderedDict({"Ward_ID": "TEXT", "Ward_Name": "TEXT", "Department": "TEXT", "Floor": "TEXT", "Capacity": "INTEGER", "Status": "TEXT DEFAULT 'Active'", "Notes": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Ward_ID"),
        ("Rooms", OrderedDict({"Room_ID": "TEXT", "Ward_ID": "TEXT", "Room_Number": "TEXT", "Room_Type": "TEXT", "Capacity": "INTEGER", "Status": "TEXT DEFAULT 'Available'", "Notes": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Room_ID"),
        ("Beds", OrderedDict({"Bed_ID": "TEXT", "Room_ID": "TEXT", "Ward_ID": "TEXT", "Bed_Number": "TEXT", "Status": "TEXT DEFAULT 'Available'", "Notes": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Bed_ID"),
        ("Progress_Notes", OrderedDict({"Note_ID": "TEXT", "Admission_ID": "TEXT", "Note_Date": "TEXT", "Note_Time": "TEXT", "Doctor_Name": "TEXT", "Note_Type": "TEXT", "Subjective": "TEXT", "Objective": "TEXT", "Assessment": "TEXT", "Plan": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Note_ID"),
        ("IPD_Medications", OrderedDict({"Med_ID": "TEXT", "Admission_ID": "TEXT", "Drug_Name": "TEXT", "Dosage": "TEXT", "Frequency": "TEXT", "Route": "TEXT", "Start_Date": "TEXT", "End_Date": "TEXT", "Notes": "TEXT", "Status": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Med_ID"),
        ("IPD_Vital_Signs", OrderedDict({"Vital_ID": "TEXT", "Admission_ID": "TEXT", "Record_Date": "TEXT", "Record_Time": "TEXT", "BP": "TEXT", "Temp": "NUMERIC", "Pulse": "INTEGER", "Resp_Rate": "INTEGER", "SpO2": "INTEGER", "Pain_Score": "INTEGER", "Consciousness": "TEXT", "Notes": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Vital_ID"),
        ("Nursing_Notes", OrderedDict({"Note_ID": "TEXT", "Admission_ID": "TEXT", "Note_Date": "TEXT", "Note_Time": "TEXT", "Nurse_Name": "TEXT", "Note_Type": "TEXT", "Content": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Note_ID"),
        ("IPD_Visits", OrderedDict({"Visit_ID": "TEXT", "Admission_ID": "TEXT", "Visit_Date": "TEXT", "Visit_Time": "TEXT", "Visitor_Type": "TEXT", "Visitor_Name": "TEXT", "Visit_Purpose": "TEXT", "Notes": "TEXT", "Created_At": "TIMESTAMPTZ DEFAULT NOW()"}), "Visit_ID"),
    ]

    admin_password_hash = hashlib.sha256("admin123".encode("utf-8")).hexdigest()
    seed_users = [
        {
            "Name": "Admin",
            "Email": "admin@his-sys.com",
            "Password": admin_password_hash,
            "Password_Hash": admin_password_hash,
            "Role": "admin",
            "Permissions": "all",
            "ButtonPermissions": json.dumps({}),
            "Status": "active",
        }
    ]
    seed_settings = [
        {"Key": "HospitalName", "Value": "One Medical Clinic"},
        {"Key": "LogoUrl", "Value": ""},
        {"Key": "OpdHeaderUrl", "Value": ""},
        {"Key": "OpdFooterUrl", "Value": ""},
    ]
    seed_wards = [{"Ward_ID": "WARD001", "Ward_Name": "General Ward", "Department": "IPD", "Floor": "1", "Capacity": 4, "Status": "Active", "Notes": "Default ward"}]
    seed_rooms = [{"Room_ID": "ROOM001", "Ward_ID": "WARD001", "Room_Number": "101", "Room_Type": "General", "Capacity": 4, "Status": "Available", "Notes": "Default room"}]
    seed_beds = [{"Bed_ID": f"BED{i:03d}", "Room_ID": "ROOM001", "Ward_ID": "WARD001", "Bed_Number": str(i), "Status": "Available", "Notes": None} for i in range(1, 5)]

    sections = [
        "-- HIS Supabase restore generated from OMC Registration.xlsx",
        f"-- All app tables are prefixed with {TABLE_PREFIX}",
        "-- Run this whole file in Supabase Dashboard > SQL Editor.",
        "BEGIN;",
        "CREATE SCHEMA IF NOT EXISTS public;",
    ]
    for name, cols, pk in tables:
        sections.append(table_sql(name, cols, pk))
        sections.append(rls_sql(name))

    sections.extend(
        [
            f'CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_MasterData_Category_Value" ON {table_ref("MasterData")} ("Category", "Value");',
            f'CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_Visits_Import_Key" ON {table_ref("Visits")} ("Import_Key");',
            f'CREATE INDEX IF NOT EXISTS "idx_HIS_One_Patients_Registration_Date" ON {table_ref("Patients")} ("Registration_Date");',
            f'CREATE INDEX IF NOT EXISTS "idx_HIS_One_Visits_Date" ON {table_ref("Visits")} ("Date");',
            f'CREATE INDEX IF NOT EXISTS "idx_HIS_One_Visits_Status" ON {table_ref("Visits")} ("Status");',
            f'CREATE INDEX IF NOT EXISTS "idx_HIS_One_Visits_Patient_ID" ON {table_ref("Visits")} ("Patient_ID");',
            f'CREATE INDEX IF NOT EXISTS "idx_HIS_One_Appointments_Appt_Date" ON {table_ref("Appointments")} ("Appt_Date");',
            'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;',
            rows_to_insert_sql("Users", seed_users, ["Email"]),
            rows_to_insert_sql("Settings", seed_settings, ["Key"]),
            rows_to_insert_sql("Patients", patients, ["Patient_ID"]),
            rows_to_insert_sql("Visits", visits, ["Import_Key"]),
            rows_to_insert_sql("Appointments", appointments, ["Appt_ID"]),
            rows_to_insert_sql("Organizations", organizations, ["Org_ID"]),
            rows_to_insert_sql("Service_Lists", services, ["ID"]),
            rows_to_insert_sql("Locations", locations, ["ID"]),
            rows_to_insert_sql("MasterData", masterdata, ["Category", "Value"]),
            rows_to_insert_sql("Drugs_Master", drugs, ["Drug_ID"]),
            rows_to_insert_sql("Vaccines_Master", vaccines, ["Vac_ID"]),
            rows_to_insert_sql("Patient_Vaccines", patient_vaccines, ["Record_ID"]),
            rows_to_insert_sql("Wards", seed_wards, ["Ward_ID"]),
            rows_to_insert_sql("Rooms", seed_rooms, ["Room_ID"]),
            rows_to_insert_sql("Beds", seed_beds, ["Bed_ID"]),
            "COMMIT;",
            "",
            "-- Quick verification after running:",
            f'-- SELECT COUNT(*) FROM {table_ref("Patients")};',
            f'-- SELECT COUNT(*) FROM {table_ref("Visits")};',
            f'-- SELECT COUNT(*) FROM {table_ref("Organizations")};',
        ]
    )
    return "\n\n".join(section for section in sections if section.strip())


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sql = build_sql()
    OUTPUT.write_text(sql, encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
