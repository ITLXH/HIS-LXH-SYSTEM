# Clinical result privacy release — 2026-10-24

Objective: prevent patient notifications and result-file access before staff authentication.
HIS guards the active UI/session, clears notifications and private windows on sign-out, sends staff bearer tokens to LIS, and proxies PDFs through staff/patient authorization. LIS verifies fresh staff accounts and existing role permissions before metadata/file reads; its native viewer fetches authenticated blobs and clears them on logout.

No database rows, clinical files, passwords, or audit records are changed. No schema migration.
Validation uses synthetic fixtures only. HIS auth/security and four focused privacy tests pass; Vite build passes. LIS 80 unit tests and Vite build pass. Browser acceptance is being verified before release.

Storage metadata review found order-result-files public. Gateway fixes alone do not close direct public URLs. Private bucket cutover must follow paired client/server deployment and verified staff PDF access; do not claim complete confidentiality before that cutover.
Existing open/downloaded files cannot be recalled. Existing browser tabs need refresh after release. Rollback must retain authorization guards; do not reopen public clinical access.

Browser verification: LIS login/history suite 49 passed, one CBC navigation timeout; the timed-out case passed on unchanged baseline and then 3/3 consecutive candidate reruns. New Chromium private-file/session/logout test passed. All fixtures synthetic.
