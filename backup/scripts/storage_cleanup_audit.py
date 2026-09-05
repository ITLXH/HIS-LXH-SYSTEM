"""Bounded one-off cleanup: expired archives and five obsolete snapshot sets only.

Default is read-only. Never writes application buckets or database tables.
Apply requires the exact SHA-256 plan produced by an earlier audit.
"""
import hashlib
import io
import json
import os
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests

URL = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
BUCKET = os.environ.get('SUPABASE_STORAGE_BUCKET') or 'his-backups'
assert URL == 'https://pzyrowzghrcfpmhkreag.supabase.co', 'Unexpected project'
assert BUCKET == 'his-backups', 'Unexpected backup bucket'
HEADERS = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
ROOT = URL + '/storage/v1'
PREFIXES = (
    'snapshots/2026/07/20260731_143950/',
    'snapshots/2026/07/20260731_150037/',
    'snapshots/2026/08/20260801_020816/',
    'snapshots/2026/08/20260801_022218/',
    'snapshots/2026/08/20260801_023958/',
)
CUTOFF = datetime.now(timezone.utc) - timedelta(days=30)


def request(method, path, **kw):
    response = requests.request(method, ROOT + path, headers=HEADERS,
                                timeout=(15, 120), **kw)
    if response.status_code not in (200, 201, 204):
        raise RuntimeError(f'Storage API {method} failed: HTTP {response.status_code}')
    return response


def inventory(bucket, prefix='', depth=0):
    assert depth < 20
    result = {}
    offset = 0
    while True:
        items = request('POST', '/object/list/' + quote(bucket, safe=''), json={
            'prefix': prefix, 'limit': 1000, 'offset': offset,
            'sortBy': {'column': 'name', 'order': 'asc'},
        }).json()
        assert isinstance(items, list), 'Invalid listing'
        for item in items:
            assert item.get('name'), 'Unnamed object'
            name = prefix + '/' + item['name'] if prefix else item['name']
            if item.get('id') is None:
                result.update(inventory(bucket, name, depth + 1))
            else:
                assert name not in result
                result[name] = item
        if len(items) < 1000:
            return result
        offset += len(items)


def size(item):
    value = int(item['metadata']['size'])
    assert value >= 0
    return value


def old(item):
    return datetime.fromisoformat(item['created_at'].replace('Z', '+00:00')) < CUTOFF


def fingerprint(item):
    return [item['id'], item.get('updated_at'), size(item)]


def main():
    objects = inventory(BUCKET)
    archives = sorted(n for n in objects if n.startswith('backups/') and n.endswith('.zip'))
    assert archives, 'No backup archives'
    newest = archives[-1]
    assert not old(objects[newest]), 'No recent backup'
    expired = [n for n in archives if old(objects[n]) and n != newest]
    retained = [n for n in archives if n not in expired]
    refs = set()
    for index, name in enumerate(retained):
        content = request('GET', '/object/' + BUCKET + '/' + quote(name, safe='/')).content
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            assert archive.testzip() is None, 'Archive CRC failed'
            manifest = json.loads(archive.read('manifest.json'))
            assert not manifest.get('failed_tables'), 'Incomplete backup'
            assert manifest.get('format_version') == 3, 'Unexpected manifest format'
            assert manifest.get('backup_scope') == 'application-data-settings-and-storage'
            assert manifest.get('storage', {}).get('enabled') is True
            assert manifest.get('table_details'), 'Missing table verification metadata'
            for table, details in manifest['table_details'].items():
                raw = archive.read('json/' + table + '.json')
                assert hashlib.sha256(raw).hexdigest() == details['sha256'], 'Table hash failed'
            counted = 0
            for bucket in manifest['storage']['buckets']:
                assert bucket['id'] != BUCKET
                for obj in bucket['objects']:
                    path = obj['backup_object']
                    assert path.startswith(('snapshots/', 'blobs/sha256/'))
                    assert path in objects, 'Retained backup references missing object'
                    assert size(objects[path]) == int(obj['size_bytes']), 'Backup blob size mismatch'
                    assert re.fullmatch('[a-f0-9]{64}', obj['sha256'])
                    refs.add(path)
                    counted += 1
            assert counted == manifest['storage']['total_objects']
        print(f'Validated retained archive {index+1}/{len(retained)}', flush=True)

    candidates = sorted(n for n, item in objects.items()
                        if n.startswith(PREFIXES) and n not in refs and old(item))
    # Never remove a partial snapshot set; unexpected references require review.
    assert not any(n.startswith(PREFIXES) for n in refs), 'Candidate snapshot remains referenced'
    assert candidates, 'No approved obsolete snapshots found'
    plan = {n: fingerprint(objects[n]) for n in sorted(expired + candidates)}
    digest = hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()
    groups = defaultdict(lambda: {'objects': 0, 'bytes': 0})
    for name in plan:
        group = '/'.join(name.split('/')[:4]) if name.startswith('snapshots/') else 'expired-archives'
        groups[group]['objects'] += 1
        groups[group]['bytes'] += size(objects[name])
    report = {'plan_sha256': digest, 'retained_archives': len(retained),
              'protected_blobs': len(refs), 'delete_objects': len(plan),
              'delete_bytes': sum(size(objects[n]) for n in plan), 'groups': dict(groups)}
    print(json.dumps(report, indent=2), flush=True)
    Path('storage-cleanup-report.json').write_text(json.dumps(report, indent=2))
    if os.environ.get('CLEANUP_APPLY', 'false') != 'true':
        print('AUDIT ONLY: nothing deleted', flush=True)
        return
    assert os.environ.get('EXPECTED_PLAN_SHA256') == digest, 'Plan changed; rerun audit'
    # Snapshot originals immediately before deletion; verify all original objects
    # still exist unchanged afterwards. Concurrent new patient files are allowed.
    buckets = request('GET', '/bucket').json()
    originals = {b['id']: inventory(b['id']) for b in buckets if b['id'] != BUCKET}
    refreshed = inventory(BUCKET)
    assert {n: fingerprint(v) for n, v in refreshed.items()} == {
        n: fingerprint(v) for n, v in objects.items()}, 'Backup inventory changed'
    # Remove expired ZIPs first, then their unreferenced sidecars. Any API failure stops.
    ordered = expired + candidates
    for offset in range(0, len(ordered), 100):
        batch = ordered[offset:offset+100]
        request('DELETE', '/object/' + BUCKET, json={'prefixes': batch})
        print(f'Deletion request completed: {min(offset+100,len(ordered))}/{len(ordered)}', flush=True)
    after = inventory(BUCKET)
    assert not set(plan).intersection(after), 'Some candidate objects remain'
    for name, item in objects.items():
        if name not in plan:
            assert name in after and fingerprint(after[name]) == fingerprint(item), 'Protected backup changed'
    for bucket, before in originals.items():
        current = inventory(bucket)
        for name, item in before.items():
            assert name in current and fingerprint(current[name]) == fingerprint(item), 'Original object changed'
    report.update({'verified_deleted_bytes': report['delete_bytes'],
                   'verified_deleted_objects': len(plan), 'original_buckets_unchanged': True,
                   'remaining_backup_bytes': sum(size(v) for v in after.values())})
    Path('storage-cleanup-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
