// HIS System - GitHub Actions Backup Configuration
// =====================================================
// Set these as window.* variables in your HTML before
// main.js loads, or configure them in a build step.
// =====================================================
//
// Example (add to an inline <script> in index.html):
//
// <script>
//   window.BACKUP_GH_OWNER = 'your-org-name';
//   window.BACKUP_GH_REPO  = 'HIS-sys-main';
//
//   // Optional - enables API trigger + polling:
//   window.BACKUP_GH_TOKEN = 'ghp_xxxx';       // PAT with 'repo' scope
//   window.GOOGLE_DRIVE_FOLDER_ID = '1abc...';  // Drive folder ID
// </script>
//
// GitHub Secrets (required for the workflow itself):
//   SUPABASE_HOST
//   SUPABASE_PASSWORD
//   GOOGLE_DRIVE_CREDENTIALS_JSON
//   GOOGLE_DRIVE_FOLDER_ID
//
// See: docs/BACKUP_PRODUCTION.md
