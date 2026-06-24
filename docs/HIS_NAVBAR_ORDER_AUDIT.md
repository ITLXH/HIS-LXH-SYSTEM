# HIS Navbar Order Audit

Date: 2026-06-24

## Request

Update the main navbar order and labels:

- Change report label to `ສະຖານະຄິວຄົນເຈັບ`.
- Restore the OPD doctor-room link label to `ຫ້ອງກວດແພດ (OPD)`.
- Add a new dropdown for `ຄົນເຈັບນອນຕິດຕາມ OPD`.
- Add a second OPD Observation dropdown item for `ລາຍຊື່ຄົນເຈັບນອນ OPD`.
- Keep the OPD Observation dropdown followed by the IPD dropdown.
- Change the IPD dropdown label to `ຄົນເຈັບນອນ IPD`.
- Move `ວັກຊີນ` and `ນັດໝາຍ` after IPD.

## Final Navbar Flow

1. Dashboard
2. Patient Queue Status
3. Visit History
4. Patients
5. Triage
6. Doctor Room (OPD)
7. OPD Observation Patients
8. Inpatients (IPD)
9. Vaccines
10. Appointments
11. Settings

## Route Safety

No routes were changed.

- `nav-report` still opens the existing report/status queue view.
- `nav-opd` still opens the existing OPD doctor-room page.
- `nav-opd_observation` opens the `/opd/observation` bed-board page from the OPD Observation dropdown.
- `nav-opd_observation_list` opens the `/opd/observation/list` patient-list page from the same dropdown.
- `nav-ipd_ward_bed` and `nav-ipd_inpatient_list` remain inside the existing IPD dropdown.
- `nav-vaccines` and `nav-appointments` keep their original routes.

## Language

Updated Lao and English translation keys:

- `nav.report`
- `nav.opd`
- `nav.opdObservationManagement`
- `nav.opdObservationBeds`
- `nav.opdObservationList`
- `nav.ipdManagement`
- `nav.vaccines`
- `nav.appointments`

## Files

- `public/partials/navbar.html`
- `src/main.js`
