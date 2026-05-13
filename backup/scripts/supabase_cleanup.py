#!/usr/bin/env python3
"""Delete backups older than N days from Supabase Storage bucket."""
import json, os, sys
from datetime import datetime, timedelta, timezone
import urllib.request


def main():
    host = os.environ.get("SUPABASE_HOST", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "")
    days = int(os.environ.get("RETENTION_DAYS", "30"))

    if not host or not key or not bucket:
        print("Skipping Supabase Storage cleanup — missing secrets")
        return

    prefix = "backups/"

    # List objects
    list_url = f"{host}/storage/v1/object/list/{bucket}"
    req = urllib.request.Request(
        list_url,
        data=json.dumps({"prefix": prefix, "limit": 1000}).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    resp = urllib.request.urlopen(req)
    objects = json.loads(resp.read())

    if not isinstance(objects, list):
        print(f"No objects found: {objects}")
        return

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
    deleted = 0

    for obj in objects:
        name = obj.get("name", "")
        if not name.endswith(".zip"):
            continue
        created = datetime.fromisoformat(obj["created"].replace("Z", "+00:00"))
        if created < cutoff:
            delete_url = f"{host}/storage/v1/object/{bucket}/{name}"
            del_req = urllib.request.Request(delete_url, method="DELETE")
            del_req.add_header("Authorization", f"Bearer {key}")
            try:
                urllib.request.urlopen(del_req)
                print(f"  Deleted from Supabase: {name}")
                deleted += 1
            except Exception as e:
                print(f"  Failed to delete {name}: {e}")

    print(f"Supabase Storage cleanup done - removed {deleted} backup(s) older than {days} days")


if __name__ == "__main__":
    main()
