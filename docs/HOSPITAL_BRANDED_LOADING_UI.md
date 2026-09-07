# Hospital-branded data loading UI (local)

Date: 2026-08-24

Status: implemented and tested locally. No commit or push was performed.

## Centered single-message revision (2026-08-25)

All hospital-logo loading states now use the same centered presentation:

- the logo and animated ring are centered horizontally in full, compact, inline, table, card, and modal loaders;
- compact/inline loaders stack the logo above the label instead of placing them side by side;
- every Lao loader displays only `ກຳລັງໂຫລດຂໍ້ມູນ` (updated wording requested on 2026-08-25);
- the secondary/subtitle line was removed;
- English mode displays the equivalent `Loading data`;
- page-specific messages passed by older call sites are intentionally ignored by the shared component so new screens cannot drift from this rule.

Static loaders in the initial system screen, Backup, Activity Log, Patient Timeline, and EMR modal were updated to the same markup.

## One Registration-style visual (2026-08-25)

Registration is now the single visual reference for every hospital-logo data loader. Full-page, system, compact, inline, table, card, and modal loaders all use:

- a maximum 220px loading card;
- the same 44px hospital logo and animated ring;
- 12px × 18px card padding;
- the same border, 5px radius, shadow, spacing, and 11.5px label;
- centered logo, label, and card alignment.

The `compact`, `inline`, and `system` class names remain for backward compatibility and placement, but no longer change the logo or card appearance. The earlier 34px, 62px, and 116px visual sizes were removed so page-specific loaders cannot drift apart.

On Registration, the DataTables processing container now only positions the shared component in the viewport. The shared component itself owns the card border, background, padding, and shadow, preventing a double card or double loading display.

## Registration follow-up fix

The Registration page originally displayed two loading states at the same time: a manually inserted table loading row and the DataTables processing panel. Registration now leaves the table body empty during initialization and uses only the DataTables hospital-logo processing panel. The built-in DataTables `loadingRecords` row is also disabled for this server-side table.

The shared processing logo is sized to 44px and includes a fallback to `/luckxay-logo.jpg` if a configured logo URL cannot load.

The logo is rendered with `object-fit: contain` and no clipping mask, so the complete hospital mark and hospital name remain visible inside the loading ring.
The initial system loader now uses the same 44px logo area and card as Registration and all other data loaders.

## Goal

Use one consistent loading state across HIS pages whenever data is being fetched:

- Luckxay Hospital logo
- animated progress ring
- clear Lao loading message
- accessible `role="status"` and `aria-live="polite"`

## Shared implementation

`src/main.js` now provides:

- `window.getHospitalDataLoaderHtml(options)` for cards, boards, modals, and inline panels
- `window.getHospitalTableLoadingRow(colspan, message, options)` for table loading rows

`src/style.css` provides one shared Registration-style visual. Full, compact, inline, and system variants retain their placement hooks while sharing the same dimensions and appearance.

The logo defaults to `/luckxay-logo.jpg` and uses the configured hospital logo when a valid `systemSettings.logoUrl` is available.

## Updated areas

- Initial system/auth loading screen
- Dashboard KPI cards
- Registration
- Report and Visit History
- Triage and OPD queue
- OPD Observation list and bed board
- Appointments
- Vaccine master and patient vaccine records
- Drug, Lab, User, Organization, Location, and Service tables
- Activity Log
- Patient Timeline
- Backup Supabase, Google Drive, workflow history, and latest status
- Public queue initial loading
- IPD ward/bed board, dashboard cards, configuration tables, inpatient list, discharge panels, and clinical chart summary
- OPD/LIS result loading and medication/lab catalog loading

Action progress indicators such as Save, PDF generation, prescribing status, and backup workflow execution remain action-specific. The hospital-logo loader is reserved for data/system loading so clinical statuses are not confused with data fetching.

## Verification

- `npm run test:loading-ui`
- `npm run test:registration-ui`
- `npm run build`

The loading UI test verifies shared helper usage, logo presence, accessible markup, CSS animation, reduced-motion handling, and removal of the old table data-loading spinners.
It also verifies the centered column layout, the single approved loading label, the absence of loader subtitles, and the shared 220px card/44px logo dimensions without variant-specific logo overrides.

Local browser verification confirmed:

- all six loader instances present in the initial app DOM (system, full, and compact variants) computed to the same 44px × 44px logo, 12px × 18px padding, 5px radius, 7px gap, 11.5px label, centered column layout, and `his-loader-ring` animation;
- each inspected instance used the single label `ກຳລັງໂຫລດຂໍ້ມູນ` and contained no subtitle;
- the system loader computed to 220px wide; full and compact loaders use the same `min(220px, 100%)` responsive cap;
- the browser inspection found no visual differences between the shared variant classes.

Final checks:

- `npm run test:loading-ui`: passed;
- `npm run test:registration-ui`: passed;
- `npm run build`: passed, with only the existing Vite large-chunk advisory.
