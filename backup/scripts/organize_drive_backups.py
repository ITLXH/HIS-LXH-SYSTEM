"""Reorganize existing backup metadata only; preserve file IDs, bytes and lookup tags.

Dry run by default. --apply writes a reversible parent-change journal before moves.
Unknown root files are left alone. No file contents or permissions are modified.
"""
import argparse
import json
import re
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

from gdrive_common import build_drive
from gdrive_upload import dated_drive_folder_path, ensure_drive_folder_path, verify_root_folder

SYSTEMS = {'HIS Backup', 'LIS Backup', 'UXI Backup', 'PMC Backup'}
FOLDER = 'application/vnd.google-apps.folder'


def destination_parts(metadata, system=None):
    name = metadata.get('name', '')
    props = metadata.get('appProperties') or {}
    snapshot = re.match(r'^backup-(\d{4}-\d{2}-\d{2})(?:_|-storage-index|\.zip)', name)
    blob = props.get('his_backup_type') == 'storage_blob' or bool(re.fullmatch(r'blob-[0-9a-f]{64}', name))
    if snapshot or blob:
        system = 'HIS Backup'
    elif props.get('his_source_bucket') == 'uxi-results':
        system = 'UXI Backup'
    elif props.get('his_source_bucket') == 'order-result-files' or name.startswith('lis-result-'):
        system = 'LIS Backup'
    if system not in SYSTEMS:
        return None
    try:
        created = datetime.fromisoformat(snapshot[1]) if snapshot else datetime.fromisoformat(metadata['createdTime'].replace('Z', '+00:00'))
    except (KeyError, TypeError, ValueError):
        return None
    parts = dated_drive_folder_path(system, created)
    return parts + ['Storage Objects'] if blob else parts


def children(drive, parent):
    token = None
    while True:
        page = drive.files().list(
            q=f"'{parent}' in parents and trashed=false", pageSize=1000, pageToken=token,
            fields='nextPageToken,files(id,name,mimeType,parents,createdTime,size,md5Checksum,appProperties)',
            supportsAllDrives=True, includeItemsFromAllDrives=True,
        ).execute(num_retries=3)
        yield from page.get('files', [])
        token = page.get('nextPageToken')
        if not token:
            return


def move_file(drive, metadata, source, destination, root, system):
    if source not in metadata.get('parents', []):
        raise RuntimeError('Source parent was not verified')
    props = dict(metadata.get('appProperties') or {})
    tag = 'his_backup_root_id' if system == 'HIS Backup' else 'his_archive_root_id'
    if props.get(tag, root) != root:
        raise RuntimeError('Backup root tag does not match the verified root')
    props[tag] = root
    result = drive.files().update(
        fileId=metadata['id'], addParents=destination, removeParents=source,
        body={'appProperties': props},
        fields='id,parents,size,md5Checksum,appProperties', supportsAllDrives=True,
    ).execute(num_retries=3)
    if result.get('id') != metadata['id'] or destination not in result.get('parents', []):
        raise RuntimeError('Drive parent update verification failed')
    for key in ('size', 'md5Checksum'):
        if metadata.get(key) != result.get(key):
            raise RuntimeError('Drive content metadata changed during move')
    if result.get('appProperties') != props:
        raise RuntimeError('Archive lookup properties were not preserved')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root-folder', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--journal', default='output/drive-organization-journal.jsonl')
    args = parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]+', args.root_folder):
        raise RuntimeError('Invalid root folder ID')
    drive = build_drive()
    verify_root_folder(drive, args.root_folder)
    queue = [(args.root_folder, [], None)]
    seen, moves, skipped = set(), [], 0
    while queue:
        parent, path, system = queue.pop()
        if parent in seen:
            raise RuntimeError('Repeated folder encountered; review backup hierarchy')
        seen.add(parent)
        for item in children(drive, parent):
            if item['mimeType'] == FOLDER:
                group = item['name'] if not path and item['name'] in SYSTEMS else system
                queue.append((item['id'], path + [item['name']], group))
                continue
            target = destination_parts(item, system)
            if target is None:
                skipped += 1
            elif path != target:
                moves.append((item, parent, target))
    print(json.dumps({'planned_moves': len(moves), 'unclassified_files_untouched': skipped,
                      'systems': dict(Counter(target[0] for _, _, target in moves))}), flush=True)
    if not args.apply:
        return
    journal = Path(args.journal)
    journal.parent.mkdir(parents=True, exist_ok=True)
    folders = {tuple(target): ensure_drive_folder_path(drive, args.root_folder, target)
               for target in sorted({tuple(target) for _, _, target in moves})}
    context = threading.local()
    def execute(entry):
        item, parent, target = entry
        if not hasattr(context, 'drive'):
            context.drive = build_drive()
        return move_file(context.drive, item, parent, folders[tuple(target)], args.root_folder, target[0])
    failures = 0
    with journal.open('a', encoding='utf-8') as log, ThreadPoolExecutor(max_workers=4) as pool:
        futures = {}
        for item, parent, target in moves:
            log.write(json.dumps({'file_id': item['id'], 'source_parent': parent,
                                  'destination_parent': folders[tuple(target)], 'md5': item.get('md5Checksum')}) + '\n')
            log.flush()
            futures[pool.submit(execute, (item, parent, target))] = item['id']
        for count, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception:
                failures += 1
                log.write(json.dumps({'file_id': futures[future], 'status': 'verification_failed'}) + '\n')
                log.flush()
            if count % 50 == 0 or count == len(moves):
                print(json.dumps({'processed': count, 'total': len(moves), 'failures': failures}), flush=True)
    if failures:
        raise RuntimeError(f'{failures} moves need review; all file bytes and IDs were retained')


if __name__ == '__main__':
    main()
