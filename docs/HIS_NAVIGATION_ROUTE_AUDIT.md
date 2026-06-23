# HIS Navigation Route Audit

Date: 2026-06-23

## Scope

Navigation was reorganized without replacing existing HIS pages. Existing internal view IDs remain available and are mapped to new hospital workflow routes.

## OPD Menu (workflow-ordered — 5 items)

The OPD dropdown now follows real clinic workflow: Register → Triage → Consult → Observe → History. ຊັກປະຫວັດ (Triage) and ປະຫວັດການກວດ (Visit History) moved into this dropdown from the top-level bar. Items 1–4 carry a numbered step badge; item 5 is below a divider as historical lookup.

| Step | Menu label | Route | Reused view |
| --- | --- | --- | --- |
| 1 | ລາຍຊື່ຄົນເຈັບ | `/patients` | `patients` |
| 2 | ຊັກປະຫວັດ | `/triage` | `triage` |
| 3 | ຄິວ OPD | `/opd/queue` | `opd` |
| 4 | ຕິດຕາມ OPD | `/opd/observation` | `opd_observation` |
| — | ປະຫວັດການກວດ | `/visit_history` | `visit_history` |

## IPD Menu (simplified — 2 items)

| Menu label | Route | Reused view |
| --- | --- | --- |
| ຈັດການຕຽງ | `/ipd/bed-management` | `ipd_ward_bed` |
| ລາຍຊື່ IPD | `/ipd/inpatients` | `ipd_inpatient_list` |

## Hidden / In-page actions

These were removed from the visible menu because they duplicated other menu items. The routes remain registered in `HIS_NAV_ROUTES` and `HIS_PATH_ROUTES` so bookmarked URLs continue to work; the actions are accessed inline:

| Removed menu | How users now access it |
| --- | --- |
| ກວດຄົນເຈັບ (`/opd/consultation`) | Click "ເປີດກວດ" on a row in ຄິວ OPD |
| IPD Dashboard (`/ipd/dashboard`) | KPI strip is already at the top of ຈັດການຕຽງ |
| ຮັບເຂົ້ານອນ (`/ipd/admission`) | Green "+ ຮັບຄົນເຈັບເຂົ້ານອນ" button in ຈັດການຕຽງ toolbar |
| ຈຳໜ່າຍອອກ (`/ipd/discharge`) | "Discharged" tab inside ລາຍຊື່ IPD |

## Old Route Redirects

| Old route | New route |
| --- | --- |
| `/opd` | `/opd/queue` |
| `/opd_observation` | `/opd/observation` |
| `/ipd_ward_bed` | `/ipd/bed-management` |
| `/ipd_inpatient_list` | `/ipd/inpatients` |

## Dashboard Navigation

| Dashboard card | Route |
| --- | --- |
| OPD Today | `/opd/queue` |
| Observation Patients | `/opd/observation` |
| Active IPD | `/ipd/inpatients` |
| Bed Occupancy | `/ipd/bed-management` |

## Separation Rule

Observation remains under OPD and continues to read/write only:

- `opd_observations`
- `opd_observation_notes`

IPD navigation points only to admitted inpatient workflow views backed by existing IPD admissions and bed tables.

## Verification

Automated checks:

- `git diff --check`: passed with line-ending warnings only.
- `npm run build`: passed. Vite emitted the existing large bundle warning.
- Local dev-server source check: served `/src/main.js` includes the new route alias layer and label keys.

Browser checks on `localhost:5176`:

- Rendered OPD/IPD menu grouping appears with correct Lao labels.
- Duplicate ID audit returned no duplicate IDs.
- Required reused views are present in the DOM: `opd`, `opd_observation`, `patients`, `ipd_ward_bed`, `ipd_inpatient_list`.

Remaining browser limitation:

- Authenticated click-through of all OPD/IPD menu routes was blocked because the browser session was on the login screen and no saved local session was available.
