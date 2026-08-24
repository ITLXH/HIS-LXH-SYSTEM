#!/usr/bin/env python3
"""Shared Google Drive authentication and API helpers for HIS backup jobs."""

import json
import os


DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"


def credentials_configured():
    return bool(
        os.environ.get("GOOGLE_DRIVE_OAUTH_JSON", "").strip()
        or os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    )


def load_drive_credentials(scopes=None):
    """Load working Drive credentials, preferring OAuth with SA fallback.

    Refresh user OAuth eagerly so an expired/revoked refresh token is detected
    before the Drive client is built. When a service account is configured it
    becomes the unattended fallback for scheduled backups.
    """
    scopes = scopes or [DRIVE_FILE_SCOPE]
    oauth_json = os.environ.get("GOOGLE_DRIVE_OAUTH_JSON", "").strip()
    service_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()

    if oauth_json:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        try:
            credentials = Credentials.from_authorized_user_info(
                json.loads(oauth_json), scopes=scopes
            )
            credentials.refresh(Request())
            return credentials
        except Exception as exc:
            if not service_json:
                raise RuntimeError(
                    "Google Drive OAuth refresh failed and no service-account "
                    "fallback is configured"
                ) from exc
            print(
                "::warning::Google Drive OAuth refresh failed; "
                "using GOOGLE_SERVICE_ACCOUNT_JSON fallback"
            )

    if service_json:
        from google.oauth2.service_account import Credentials

        return Credentials.from_service_account_info(json.loads(service_json), scopes=scopes)

    raise RuntimeError(
        "Google Drive credentials are not configured; set "
        "GOOGLE_DRIVE_OAUTH_JSON or GOOGLE_SERVICE_ACCOUNT_JSON"
    )


def build_drive(scopes=None):
    from googleapiclient.discovery import build

    return build(
        "drive",
        "v3",
        credentials=load_drive_credentials(scopes),
        cache_discovery=False,
    )


def drive_create(drive, **kwargs):
    kwargs.setdefault("supportsAllDrives", True)
    return drive.files().create(**kwargs).execute()


def drive_get(drive, **kwargs):
    kwargs.setdefault("supportsAllDrives", True)
    return drive.files().get(**kwargs).execute()


def drive_delete(drive, file_id):
    return drive.files().delete(fileId=file_id, supportsAllDrives=True).execute()
