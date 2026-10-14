# API request reduction — 2026-10-06

## Scope and authorization

Reduce unnecessary requests without disrupting ongoing clinical work. Test before commit/push. Record changes and validation in Markdown. This first change addresses the Archive status dashboard; OPD/LIS clinical polling is unchanged. No production requests, data changes, migrations, archive dispatches, or deployment were performed.

## Findings

The Archive module loaded with the app and polled every 10 seconds even when its view was hidden. Each status call validates Auth, reads the staff profile, and reads the progress object: about 1,080 Supabase requests per hour per continuously open tab. OPD and LIS also have separate clinical polling; modifying those requires separate realtime/fallback validation. Screenshot error totals do not establish the cause of Postgres or HTTP errors.

## Changes

- Only request status while the Archive panel is visible and the document is foregrounded.
- Clear scheduled requests when leaving the panel or backgrounding the tab; refresh when returning.
- Share the pending status promise across concurrent refresh callers.
- Schedule the next request after completion, rather than using a fixed interval that can overlap slow responses.
- Poll active runs every 10 seconds and idle/completed runs every 60 seconds. Idle polling still discovers runs started externally.
- Back off failed status requests from at least 30 seconds up to 5 minutes.
- Remove the additional delayed refresh after manual dispatch; the existing final refresh and scheduler cover status updates.
- Keep server authentication/permission checks and copy-only archive behavior intact.

Expected Archive request reduction: zero recurring status requests while hidden; approximately 180 Supabase requests/hour for a visible idle panel (about 83% less than before), excluding opening/manual refreshes. Active-run polling retains its existing frequency. These are code-derived estimates, not measured production totals.

## Validation

Passed locally:

- Behavioral VM test executing the dashboard module with mocked DOM/network/timers: hidden initial view, concurrent callers, idle cadence, active cadence, leaving the view, background tab, error backoff, and hiding during an in-flight request.
- Existing LIS archive gateway and API control tests, including non-destructive dispatch.
- Authentication guards and session policy tests.
- All 25 clinical notification checks (source-level regression checks).
- Backup automation checks.
- Production Vite build. Initial sandbox build could not read parent directory metadata; approved local build succeeded. Existing large-bundle warning remains.
- `git diff --check`.

## Release gate and remaining verification

Automated checks are not a live clinical end-to-end guarantee. Before pushing a release, verify with a test account in a safe preview: open/leave Backup, background/return to the tab, monitor network counts, start a copy-only test archive, confirm progress and completion, and exercise normal OPD/LIS notifications plus reconnect behavior. No production archive was started for testing. Commit/push is held pending this browser/session verification.

Production builds currently invalidate prior application session versions, so release timing must account for possible login prompts. Preserve unrelated pre-existing edits in `scripts/test-triage-clinical-crud.mjs` and activity-log migrations; do not include them in this change.
