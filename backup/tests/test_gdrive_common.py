import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backup" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import gdrive_common


class GoogleDriveCredentialsTests(unittest.TestCase):
    def test_valid_oauth_is_preferred(self):
        oauth_credentials = Mock()
        oauth_payload = {"refresh_token": "test", "client_id": "id", "client_secret": "secret"}

        with patch.dict(
            os.environ,
            {
                "GOOGLE_DRIVE_OAUTH_JSON": json.dumps(oauth_payload),
                "GOOGLE_SERVICE_ACCOUNT_JSON": json.dumps({"type": "service_account"}),
            },
            clear=True,
        ), patch(
            "google.oauth2.credentials.Credentials.from_authorized_user_info",
            return_value=oauth_credentials,
        ), patch("google.auth.transport.requests.Request", return_value=Mock()), patch(
            "google.oauth2.service_account.Credentials.from_service_account_info"
        ) as service_loader:
            result = gdrive_common.load_drive_credentials()

        self.assertIs(result, oauth_credentials)
        oauth_credentials.refresh.assert_called_once()
        service_loader.assert_not_called()

    def test_revoked_oauth_falls_back_to_service_account(self):
        oauth_credentials = Mock()
        oauth_credentials.refresh.side_effect = RuntimeError("invalid_grant")
        service_credentials = Mock()

        with patch.dict(
            os.environ,
            {
                "GOOGLE_DRIVE_OAUTH_JSON": json.dumps({"refresh_token": "revoked"}),
                "GOOGLE_SERVICE_ACCOUNT_JSON": json.dumps({"type": "service_account"}),
            },
            clear=True,
        ), patch(
            "google.oauth2.credentials.Credentials.from_authorized_user_info",
            return_value=oauth_credentials,
        ), patch("google.auth.transport.requests.Request", return_value=Mock()), patch(
            "google.oauth2.service_account.Credentials.from_service_account_info",
            return_value=service_credentials,
        ) as service_loader:
            result = gdrive_common.load_drive_credentials()

        self.assertIs(result, service_credentials)
        service_loader.assert_called_once()

    def test_revoked_oauth_without_fallback_has_clear_error(self):
        oauth_credentials = Mock()
        oauth_credentials.refresh.side_effect = RuntimeError("invalid_grant")

        with patch.dict(
            os.environ,
            {"GOOGLE_DRIVE_OAUTH_JSON": json.dumps({"refresh_token": "revoked"})},
            clear=True,
        ), patch(
            "google.oauth2.credentials.Credentials.from_authorized_user_info",
            return_value=oauth_credentials,
        ), patch("google.auth.transport.requests.Request", return_value=Mock()):
            with self.assertRaisesRegex(RuntimeError, "no service-account fallback"):
                gdrive_common.load_drive_credentials()


if __name__ == "__main__":
    unittest.main()
