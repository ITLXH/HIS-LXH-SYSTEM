# User requested changes

Keep one dated entry for each shipped change. Each entry must name the request, changed files, verification, release commit, and any unverified behavior. Do not mark a request complete from source changes alone.

## 2026-11-15 — OPD inline medication drafts

- Request: match the latest local medication UI, with one editable row per selected drug.
- Release: `025d831d` on HIS production; see [release gap](OPD_NAVBAR_SETTINGS_RELEASE_GAP_2026-11-15.md) for the changes intentionally left out.
- Verification: build and focused synthetic medication tests passed in the prior release. Authenticated clinical submission was not performed.

## 2026-11-15 — Navbar and settings page

- Request: replace the settings dropdown with a direct page; group settings, separate Lab and medication controls, and put investigation forms on their own route.
- Changed: `public/partials/navbar.html`, `public/partials/views/settings.html`, `public/partials/views/settings_hub.html`, `public/partials/views/investigation_templates.html`, `src/main.js`, `src/style.css`, focused checks.
- Verification before release: settings hub, investigation route, navbar scale, auth, security, OPD persistence, simple medication tests, and Vite build passed.
- Visual status: local browser preview could not connect; production authenticated navigation remains to be checked after deployment.
- Release commit: pending; update this line once deployed.

## Open requests

See [OPD_NAVBAR_SETTINGS_RELEASE_GAP_2026-11-15.md](OPD_NAVBAR_SETTINGS_RELEASE_GAP_2026-11-15.md) for the remaining OPD five tab density, login centering, and HIS–PMC end-to-end verification. Keep these open until rendered and workflow checks are recorded.
