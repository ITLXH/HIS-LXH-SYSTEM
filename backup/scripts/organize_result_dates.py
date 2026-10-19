"""Repair result-folder dates from a verified backup, without reading result PDFs.

Dry-run by default. --apply preserves file IDs, content and lookup properties.
The selected backup is downloaded into memory only. Output contains aggregates.
"""
import argparse
import hashlib
import json
import re
import threading
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

from gdrive_common import build_drive
from gdrive_upload import clinical_archive_date, dated_drive_folder_path, ensure_drive_folder, verify_root_folder
from organize_drive_backups import children, move_file, FOLDER
from restore_rest import validate_archive


def build_date_index(tables):
    dates = defaultdict(set)
    orders = defaultdict(set)
    for row in tables.get('lis_one_test_orders', []):
        try:
            orders[str(row.get('order_id'))].add(clinical_archive_date(row.get('order_datetime')))
        except RuntimeError:
            orders[str(row.get('order_id'))].add(None)
    for row in tables.get('lis_one_order_result_files', []):
        path = str(row.get('storage_path') or '')
        order_id = str(row.get('order_id') or '')
        if not path or path.split('/')[0] != order_id:
            continue
        dates[('order-result-files', path)].update(orders.get(order_id, {None}))
    for row in tables.get('UXI_One_main_imaging_orders', []):
        try:
            date = clinical_archive_date(row.get('ordered_at'))
        except RuntimeError:
            date = None
        for result in row.get('result_files') or []:
            if not isinstance(result, dict):
                continue
            path = str(result.get('storagePath') or '')
            parts = path.split('/')
            if len(parts) == 2 and all(parts) and unquote(parts[0]) == str(row.get('id') or ''):
                dates[('uxi-results', path)].add(date)
    return {(bucket, hashlib.sha256(f'{bucket}/{path}'.encode()).hexdigest()): next(iter(values))
            for (bucket, path), values in dates.items() if len(values) == 1 and None not in values}


def list_tagged(drive, root, kind):
    token = None
    while True:
        page = drive.files().list(
            q=f"appProperties has {{key='{kind}' and value='{root}'}} and trashed=false",
            fields='nextPageToken,files(id,name,mimeType,parents,size,md5Checksum,appProperties)',
            pageSize=1000, pageToken=token, supportsAllDrives=True, includeItemsFromAllDrives=True,
        ).execute(num_retries=3)
        yield from page.get('files', [])
        token = page.get('nextPageToken')
        if not token:
            return


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root-folder', required=True)
    parser.add_argument('--journal', default='output/result-date-moves.jsonl')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.root_folder):
        raise RuntimeError('Invalid root ID')
    drive = build_drive()
    verify_root_folder(drive, args.root_folder)
    backups = [f for f in list_tagged(drive, args.root_folder, 'his_backup_root_id')
               if f['mimeType'] == 'application/zip' and f.get('appProperties', {}).get('his_backup_scope') == 'complete_incremental']
    latest = max(backups, key=lambda f: f['name'])
    raw = drive.files().get_media(fileId=latest['id'], supportsAllDrives=True).execute(num_retries=3)
    props = latest['appProperties']
    if (len(raw) != int(latest['size']) or hashlib.md5(raw).hexdigest() != latest['md5Checksum']
            or hashlib.sha256(raw).hexdigest() != props['his_sha256']):
        raise RuntimeError('Backup checksum verification failed')
    archive, manifest, tables, _ = validate_archive(raw)
    try:
        index = build_date_index(tables)
    finally:
        archive.close()
    del raw, tables
    # Verify actual ancestry before any move; root tags alone are insufficient.
    paths, queue = {args.root_folder: []}, [args.root_folder]
    while queue:
        parent = queue.pop()
        for folder in children(drive, parent):
            if folder['mimeType'] == FOLDER:
                if folder['id'] in paths:
                    raise RuntimeError('Repeated folder')
                paths[folder['id']] = paths[parent] + [folder['name']]
                queue.append(folder['id'])
    folders = {tuple(path): folder for folder, path in paths.items()}
    # Duplicate empty setup folders are harmless, but never choose duplicate targets.
    duplicates = {tuple(path) for path in paths.values() if list(paths.values()).count(path) > 1}
    plans, skipped, counts = [], 0, Counter()
    for item in list_tagged(drive, args.root_folder, 'his_archive_root_id'):
        props = item.get('appProperties') or {}
        bucket = props.get('his_source_bucket')
        system = {'order-result-files': 'LIS Backup', 'uxi-results': 'UXI Backup'}.get(bucket)
        if not system or props.get('his_archive_type') not in {'lis_result', 'uxi_result'}:
            continue
        date = index.get((bucket, props.get('his_source_path_sha256')))
        parents = item.get('parents', [])
        if not date or len(parents) != 1 or parents[0] not in paths:
            skipped += 1
            continue
        target = dated_drive_folder_path(system, datetime.fromisoformat(date))
        if any(tuple(target[:i]) in duplicates for i in range(1, len(target) + 1)):
            raise RuntimeError('Ambiguous destination folders')
        if paths[parents[0]] != target or props.get('his_clinical_date') != date:
            plans.append((item, parents[0], target, date, system))
            counts[date] += 1
    print(json.dumps({'backup_id': latest['id'], 'planned_updates': len(plans),
                      'unmatched_retained': skipped, 'clinical_dates': dict(sorted(counts.items()))}), flush=True)
    if not args.apply:
        return
    journal = Path(args.journal)
    journal.parent.mkdir(parents=True, exist_ok=True)
    for _, _, target, _, _ in plans:
        for depth in range(1, len(target) + 1):
            key = tuple(target[:depth])
            if key not in folders:
                folders[key] = ensure_drive_folder(drive, folders[tuple(target[:depth - 1])], key[-1])
    context = threading.local()
    def apply_plan(plan):
        item, source, target, date, system = plan
        if not hasattr(context, 'drive'):
            context.drive = build_drive()
        worker = context.drive
        destination = folders[tuple(target)]
        updated = {**item, 'appProperties': {**item.get('appProperties', {}),
            'his_clinical_date': date,
            'his_clinical_date_source': 'order_datetime' if system == 'LIS Backup' else 'ordered_at'}}
        if source != destination:
            move_file(worker, updated, source, destination, args.root_folder, system)
        else:
            result = worker.files().update(fileId=item['id'], body={'appProperties': updated['appProperties']},
                fields='id,size,md5Checksum,appProperties', supportsAllDrives=True).execute(num_retries=3)
            if any(result.get(key) != updated.get(key) for key in ['id', 'size', 'md5Checksum', 'appProperties']):
                raise RuntimeError('Metadata update verification failed')
    with journal.open('a', encoding='utf-8') as log:
        for item, source, target, date, system in plans:
            log.write(json.dumps({'id': item['id'], 'source': source, 'destination': folders[tuple(target)],
                                  'old_properties': item.get('appProperties', {})}) + '\n')
            log.flush()
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(apply_plan, plan): plan[0]['id'] for plan in plans}
            failures = 0
            for number, future in enumerate(as_completed(futures), 1):
                try:
                    future.result()
                except Exception:
                    failures += 1
                    log.write(json.dumps({'id': futures[future], 'verification_failed': True}) + '\n')
                    log.flush()
                if number % 100 == 0 or number == len(plans):
                    print(json.dumps({'processed': number, 'total': len(plans), 'failures': failures}), flush=True)
            if failures:
                raise RuntimeError(f'{failures} metadata updates require review; originals retained')


if __name__ == '__main__':
    main()
