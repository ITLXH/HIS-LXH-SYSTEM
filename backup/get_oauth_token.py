#!/usr/bin/env python3
"""
HIS Google Drive Auth - run ONCE to get OAuth token.
Usage:
    cd backup
    pip install -r requirements.txt
    python get_oauth_token.py
This opens a browser for Google login. After authorizing, saves google-token.json.
"""

import os
import sys
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow

SCRIPT_DIR = Path(__file__).resolve().parent
CRED_FILE = SCRIPT_DIR.parent / "config" / "google-drive-credentials.json"
TOKEN_FILE = SCRIPT_DIR / "google-token.json"

# Scope: create/edit files in Drive
SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def main():
    if not CRED_FILE.exists():
        print(f"ERROR: Google credentials not found at: {CRED_FILE}")
        print(
            "Put your OAuth 2.0 credentials at config/google-drive-credentials.json"
        )
        sys.exit(1)

    print("=" * 60)
    print("HIS Google Drive Authorization")
    print("=" * 60)
    print(f"Checking credentials: {CRED_FILE}")
    print("Opening browser for Google login...")
    print("After you authorize, the token will be saved to:")
    print(f"  {TOKEN_FILE}")
    print()

    try:
        flow = InstalledAppFlow.from_client_secrets_file(str(CRED_FILE), SCOPES)
        creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

        print()
        print("=" * 60)
        print(f"SUCCESS! Token saved to {TOKEN_FILE}")
        print("You can now run backup.py for automated backups.")
        print("=" * 60)
    except Exception as e:
        print(f"ERROR: {e}")
        print()
        print("Troubleshooting:")
        print("  1. Make sure OAuth credentials include 'http://localhost' as redirect URI")
        print("  2. In Google Cloud Console -> APIs & Services -> OAuth consent screen")
        print("     make sure the app is in Testing or Published mode")
        sys.exit(1)


if __name__ == "__main__":
    main()
