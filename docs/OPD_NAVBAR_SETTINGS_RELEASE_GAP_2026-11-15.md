# OPD, navbar, and settings release gap — 2026-11-15

## Finding

The 2026-11-15 production medication release ported the latest inline medication draft rows from the local working tree into an isolated release worktree. It did **not** include the other local navbar and settings changes. The production screenshot supplied by the user still shows the old settings dropdown, which matches the release source. The local working tree contains many unrelated uncommitted changes, so it must not be deployed wholesale.

## Evidence checked

- Local branch: `codex/reduce-api-requests-20261006`, at `3f3e652`, with modified and untracked files.
- Medication release worktree: `tmp/his-pmc-native-release-20261115`, at `046c4fc` before its production squash merge (`025d831d` reported in the release session).
- Release `public/partials/navbar.html` has the old Admin dropdown and `#nav-settings`; it has no `#nav-settings_hub`.
- Release `public/partials/views/settings.html` still embeds `#investigationTemplateEditor`; release tree has no `settings_hub.html` or `investigation_templates.html` view.
- Local `public/partials/navbar.html` has a direct `#nav-settings_hub` link; local `src/main.js` maps `/settings/menu` and `/settings/investigation-templates` to separate views.
- Local structural checks passed: `node scripts/test-settings-hub.mjs`, `node scripts/test-investigation-settings-route.mjs`, and `node scripts/test-navbar-scale.mjs`. These do not prove production behavior or full visual quality.

## Requested changes and current status

| Earlier user request | Local working tree | Medication release / production evidence | Next verification |
| --- | --- | --- | --- |
| Settings in a full page rather than a navbar dropdown | Direct `#nav-settings_hub` link and `/settings/menu` view | Old settings dropdown remains | Port navbar, route, view, styles, and role visibility together; verify navigation in browser |
| Settings grouped for readability and less empty space | `settings_hub.html` groups services, lab, medication, staff, tools, system | No settings hub in release | Check 1366×768 and Lao wrapping, keyboard focus, permissions |
| Investigation request form in its own page | `/settings/investigation-templates` and `investigation_templates.html`; removed from local `settings.html` | Editor still embedded in release `settings.html` | Port route and editor without changing stored templates; test import/export/preview |
| Lab list separate from medication settings | Lab management group links to `/labs`; lab category link to master data | Old mixed menu | Verify both links and category selection |
| Medication management group with icons | Hub has drug catalog and medication master link; master categories have route/frequency/duration icons | Old mixed menu | Verify icons, labels, navigation, and access by role |
| Medication route, frequency, duration in settings | Local `MedicationRoute`, `MedicationFrequency`, `MedicationDuration` categories and validation | Not in release settings | Test CRUD and compatibility with OPD medication dropdowns using synthetic data |
| Compact OPD Clinical, Lab, Ultrasound, X-Ray, Medication tabs | Local `src/style.css` includes tab, header, empty-state, and footer rules | Medication release only carried selected medication UI/CSS | Render all five tabs at requested viewports and zoom levels; inspect computed heights and scrolling |
| Medication list in one row and no oversized empty panel | Local inline medication draft table; carried into medication release | Code released, but authenticated production visual check was blocked by login | Verify with a synthetic/test visit; do not use real patient screenshots |
| Save medication and submit to PMC automatically | Local and release have native PMC submission path | Production API/UI state needs authenticated end-to-end proof | Use synthetic staging order and check HIS plus PMC receipt; do not infer success from UI alone |
| Center login form | Previous screenshot showed left-aligned login | Not checked in this audit | Inspect current login markup/CSS and test desktop/mobile separately |

## Safe release scope

1. Extract only navbar/settings routes, templates, styles, and their focused tests into a clean worktree based on the current production commit. Preserve all unrelated local edits.
2. Check role and permission filtering for each settings destination. Keep existing data validation, clinical order flows, and backend contracts.
3. Run focused navbar/settings/investigation tests and build to a fresh `tmp/` output directory.
4. Visually test settings hub and each destination using synthetic data. Confirm the navbar no longer renders the old dropdown and direct navigation works after refresh.
5. Release separately from other dirty work only after those checks; then verify deployed asset/version and authenticated navigation. A source test alone is insufficient.

## Release work log — 2026-11-15

The isolated `codex/navbar-settings-release-20261115` worktree was created from production `025d831d`. The following files were changed for this settings release:

- `public/partials/navbar.html`: replace the old settings dropdown with a direct settings page link; retain OPD/IPD routes while hiding deferred items in the top bar; add accessible hamburger attributes.
- `public/partials/views/settings_hub.html`: six grouped settings sections with direct links and consistent icons.
- `public/partials/views/settings.html`: compact MasterData workspace and pharmacy route, frequency, duration categories; remove embedded investigation form.
- `public/partials/views/investigation_templates.html`: give the investigation form its own page.
- `src/main.js`: register both routes and views, handle settings links, filter each link by the existing permission rules, render the separate investigation editor, show medication category defaults and validate MasterData entries.
- `src/style.css`: compact navbar and settings page layout using the existing brand blue, readable Lao text, and visible focus states.
- Focused checks: `scripts/test-settings-hub.mjs`, `scripts/test-investigation-settings-route.mjs`, `scripts/test-navbar-scale.mjs`.

Checks completed before release: all three focused scripts passed; `npm run test:auth`, `npm run test:security`, `npm run test:opd`, and `npm run test:simple-medication` passed. `npm run build -- --outDir tmp/check-navbar-settings-complete-20261115` passed (150 modules). Bundler warned about large chunks. The local synthetic browser preview could not load through the browser bridge, so rendered layout has **not** been visually certified yet.

## Limits of this audit

This document records a source-to-release comparison and the user-provided production screenshot. Authenticated production visual navigation and medication submission require separate verification. No clinical data or database migration was changed in this settings release.

## Status correction after release — 2026-11-15

The table above captures the gap **before** PR #40 and is retained as historical evidence. PR #40 shipped the navbar/settings changes to production at `f545e7f948f0`. The production `version.json`, navbar partial, grouped settings hub, separate investigation template partial, and JavaScript route strings were fetched and verified after deployment. The old `#nav-settings` dropdown is absent from the deployed navbar partial; `#nav-settings_hub` is present.

This release did not certify authenticated visual navigation. The five OPD tabs still need rendered comparison at 1366×768, 1536×864, 1920×1080, and 125% zoom. Local-only tests for OPD visual consistency, medication layout, and the PMC exchange element fail against release source and describe a different iteration. The source contains a native PMC submission path, but no synthetic authenticated HIS-to-PMC receipt has been observed. Keep these items open; do not infer success from shipped files or the SweetAlert message. The login alignment has not been verified in a rendered browser.

See [USER_REQUEST_CHANGELOG.md](USER_REQUEST_CHANGELOG.md) for the continuing release ledger. Each subsequent change should get its own dated entry with files, tests, release SHA, and unverified behavior.
