#!/usr/bin/env python3
"""Supabase backup via REST API — works from GitHub Actions (no direct DB access needed)."""
import json, os, sys, csv, zipfile
import hashlib
from datetime import datetime
from pathlib import Path

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "")
RETENTION_DAYS = int(os.environ.get("RETENTION_DAYS", "30"))
OUTPUT = Path(os.environ.get("OUTPUT_DIR", "output"))

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "count=exact",
}

# Fallback table names — HIS_One_ prefix as used in this project
KNOWN_TABLES = [
    "HIS_One_Users", "HIS_One_Settings", "HIS_One_Patients",
    "HIS_One_Appointments", "HIS_One_Locations", "HIS_One_Organizations",
    "HIS_One_OrgUsers", "HIS_One_MasterData",
    "HIS_One_activity_logs", "HIS_One_PatientVaccines",
    "HIS_One_TriageLogs", "HIS_One_OPDRecords", "HIS_One_IPDRecords",
    "HIS_One_LabOrders", "HIS_One_LabResults",
    "HIS_One_Inventory", "HIS_One_Reagents", "HIS_One_Drugs",
    "HIS_One_Sessions", "HIS_One_Notifications",
]


def discover_tables():
    """Use OpenAPI spec or HEAD probes to find real public tables."""
    # Try OpenAPI spec
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/?apikey={SERVICE_KEY}",
            headers={"Accept": "application/json"},
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                tables = []
                for item in data:
                    if isinstance(item, dict):
                        name = item.get("name") or item.get("table") or item.get("entity")
                        if name:
                            tables.append(name)
                    elif isinstance(item, str):
                        tables.append(item)
                tables = sorted(set(tables))
                if tables:
                    print(f"  OpenAPI discovery found {len(tables)} tables")
                    return tables
            elif isinstance(data, dict):
                defs = data.get("definitions", data.get("components", {}).get("schemas", {}))
                if isinstance(defs, dict):
                    tables = sorted(defs.keys())
                    if tables:
                        print(f"  OpenAPI definitions found {len(tables)} tables")
                        return tables
    except Exception as e:
        print(f"  OpenAPI discovery skipped: {e}")

    # Fallback: probe known table names
    print("  Probing known table names...")
    existing = []
    for t in KNOWN_TABLES:
        try:
            r = requests.head(f"{SUPABASE_URL}/rest/v1/{t}", headers=HEADERS, timeout=10)
            if r.status_code in (200, 206):
                existing.append(t)
                print(f"    Found: {t} (HTTP {r.status_code})")
        except Exception:
            pass
    return existing


def export_table(table):
    """Export a table via REST API with pagination."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    offset = 0
    limit = 1000
    all_rows = []

    while True:
        resp = requests.get(
            url,
            params={"select": "*", "limit": str(limit), "offset": str(offset)},
            headers=HEADERS,
            timeout=60,
        )
        if resp.status_code in (200, 206):
            rows = resp.json()
            if not rows:
                break
            all_rows.extend(rows)
            offset += limit
            if offset >= 100000:
                break
        elif resp.status_code == 416:
            break
        else:
            print(f"    HTTP {resp.status_code} on {table} at offset {offset}: {resp.text[:200]}")
            break

    # Deduplicate by id
    seen = set()
    unique = []
    for row in all_rows:
        key = row.get("id", str(row))
        if key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


def save_csv(table, rows, path):
    if not rows:
        return 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def upload_supabase_storage(zip_path, object_path):
    """Upload file to Supabase Storage bucket."""
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{object_path}"
    with open(zip_path, "rb") as f:
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {SERVICE_KEY}",
                "Content-Type": "application/zip",
            },
            data=f,
            timeout=300,
        )
    return resp


def cleanup_supabase_storage():
    """Delete old backups from Supabase Storage."""
    prefix = "backups/"
    list_url = f"{SUPABASE_URL}/storage/v1/object/list/{SUPABASE_BUCKET}"
    resp = requests.post(
        list_url,
        headers={"Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"},
        data=json.dumps({"prefix": prefix, "limit": 1000}),
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"  List failed: HTTP {resp.status_code}")
        return 0

    objects = resp.json()
    if not isinstance(objects, list):
        return 0

    cutoff = datetime.now() - __import__('datetime').timedelta(days=RETENTION_DAYS)
    deleted = 0
    for obj in objects:
        name = obj.get("name", "")
        if not name.endswith(".zip"):
            continue
        try:
            created = datetime.fromisoformat(obj["created"].replace("Z", "+00:00"))
        except Exception:
            continue
        if created < cutoff:
            del_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{name}"
            dr = requests.delete(del_url, headers={"Authorization": f"Bearer {SERVICE_KEY}"}, timeout=30)
            if dr.status_code in (200, 204):
                print(f"  Deleted from Supabase: {name}")
                deleted += 1
    return deleted


def main():
    print("=" * 60)
    print("HIS Database Backup — REST API mode")
    print("=" * 60)

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    zip_name = f"backup-{today}.zip"
    zip_path = OUTPUT / zip_name

    # Discover tables
    print("\n[1/4] Discovering tables...")
    tables = discover_tables()
    print(f"  Found {len(tables)} tables: {', '.join(tables)}")

    # Export each table
    print("\n[2/4] Exporting tables via REST API...")
    (OUTPUT / "csv").mkdir(parents=True, exist_ok=True)
    csv_files = []
    total_rows = 0
    failed = []

    for i, table in enumerate(tables):
        try:
            rows = export_table(table)
            csv_path = OUTPUT / "csv" / f"{table}.csv"
            count = save_csv(table, rows, csv_path)
            if count > 0:
                csv_files.append(str(csv_path))
            total_rows += count
            print(f"    {table}: {count} rows")
        except Exception as e:
            print(f"    {table}: FAILED — {e}")
            failed.append(table)

    print(f"\n  Total: {total_rows} rows across {len(csv_files)} tables ({len(failed)} failed)")

    # Zip everything
    print(f"\n[3/4] Creating zip archive: {zip_name}")
    csv_paths = [Path(fp) for fp in csv_files]
    if csv_paths:
        with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
            for fp in csv_paths:
                zf.write(fp, "csv/" + fp.name)
    else:
        print("  No CSV data — creating manifest-only zip")
        with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
            pass

    size = zip_path.stat().st_size
    sha = sha256(str(zip_path))
    print(f"  Size: {size:,} bytes ({size / 1024 / 1024:.1f} MB)")
    print(f"  SHA-256: {sha}")

    # Upload to Supabase Storage
    print(f"\n[4/4] Uploading to Supabase Storage...")
    sb_url_out = None
    if SUPABASE_BUCKET:
        ts_suffix = now.strftime("%Y%m%d_%H%M%S")
        zip_name_ts = f"backup-{today}_{ts_suffix}.zip"
        object_path = f"backups/{now.strftime('%Y/%m')}/{zip_name_ts}"
        try:
            resp = upload_supabase_storage(str(zip_path), object_path)
            if resp.status_code in (200, 201):
                sb_url_out = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{object_path}"
                print(f"  SUCCESS: {sb_url_out}")
            else:
                print(f"  FAILED (HTTP {resp.status_code}): {resp.text[:300]}")
        except Exception as e:
            print(f"  FAILED: {e}")
    else:
        print("  SKIPPED (SUPABASE_STORAGE_BUCKET not set)")

    # Cleanup old backups
    print(f"\nCleaning up old backups (>{RETENTION_DAYS} days)...")
    try:
        sb_deleted = cleanup_supabase_storage()
        print(f"  Supabase: {sb_deleted} deleted")
    except Exception as e:
        print(f"  Supabase cleanup error: {e}")

    # Manifest
    manifest = {
        "date": today,
        "time": now.isoformat(),
        "filename": zip_name,
        "tables": len(csv_files),
        "total_rows": total_rows,
        "failed_tables": failed,
        "sha256": sha,
        "size_bytes": size,
    }
    manifest_path = OUTPUT / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 60)
    print("BACKUP COMPLETE")
    print("=" * 60)

    # GitHub Actions outputs
    outputs_path = os.environ.get("GITHUB_OUTPUT", "")
    if outputs_path:
        with open(outputs_path, "a") as f:
            f.write(f"zip_size={size}\n")
            f.write(f"total_rows={total_rows}\n")
            f.write(f"backup_tables={len(csv_files)}\n")
            if sb_url_out:
                f.write(f"supabase_url={sb_url_out}\n")

    return len(failed) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
