# Doctor EMR Redesign Phase 1

Status: local prototype only. No deployment, migration, commit, or push is part of this phase.

## Objective

Turn the existing doctor page into a fast clinical workspace where a normal outpatient encounter can be documented, ordered, reviewed, prescribed, summarized, and signed without leaving the EMR page.

The Phase 1 prototype is available at `/opd/test`. It uses local demo state and does not write to the production database or LIS.

## Current Problem

- Patient identity, allergy, history, and current visit information are separated from the doctor's main work area.
- Clinical documentation is not organized around the doctor's normal sequence of work.
- A free-text diagnosis cannot reliably support ICD-10 reporting or multiple diagnoses.
- Lab ordering and result review require too much context switching.
- Repeated provider cards and large confirmation panels consume screen space without helping the doctor finish faster.
- Previous history and nurse-recorded Vital Signs are not presented as one concise, read-only clinical summary.
- The previous prototype did not provide a complete path from assessment to a signed encounter.

## New Workflow

1. Open the patient from the OPD queue. The fixed patient header remains visible and shows HN, VN, encounter number, name, age, gender, blood group, allergy, chronic disease, and last visit.
2. Review the left clinical summary. Visit information, nurse-recorded Vital Signs, disease history, previous medication, and previous diagnosis load automatically.
3. Record the chief complaint, current illness history, and focused physical examination. A department template can populate normal examination values.
4. Search the local ICD-10 catalog and add one or more diagnoses. The first selected item is the primary diagnosis.
5. Select laboratory or radiology items and send one combined order to LIS.
6. Review returned LIS results inside EMR. Abnormal values are visually highlighted and radiology requests can remain pending.
7. Add medication with drug, dose, route, frequency, and duration after reviewing the fixed allergy alert.
8. Complete the assessment, plan, follow-up date, and advice, then sign and complete the encounter. Completion locks editable controls.

## Speed Features

- Previous clinical history is displayed automatically in the summary sidebar.
- Department templates fill focused examination fields.
- `Alt+1` through `Alt+6` switch the six clinical tabs.
- `Ctrl+S` saves a local draft.
- `Ctrl+Enter` validates and completes the encounter.
- The fixed patient header keeps identity and allergy context visible while scrolling.
- Counts on diagnosis, order, result, and medication tabs show outstanding work without extra confirmation cards.
- The mobile clinical summary is collapsed by default and can be expanded when needed.

## UI Changes

### Fixed Patient Header

Displays patient identifiers and safety-critical context together with the three primary actions:

- ບັນທຶກຮ່າງ
- ສົ່ງຄຳສັ່ງ
- ສຳເລັດການກວດ

### Clinical Summary Sidebar

The sidebar replaces the old checklist and repeated provider cards. Vital Signs are read-only because the nurse owns the original measurement record.

### Six-Tab Workspace

| Tab | Purpose |
| --- | --- |
| ການປະເມີນ | Chief complaint, current illness history, department template, physical examination |
| ການວິນິດໄສ | ICD-10 search, multiple diagnoses, primary diagnosis ordering |
| ສັ່ງກວດ | Laboratory, radiology, priority, and clinical reason |
| ຜົນກວດ | Returned LIS values, abnormal flags, verification status, pending radiology |
| ແຜນການຮັກສາ | Drug, dose, route, frequency, duration, and allergy context |
| ສະຫຼຸບການຮັກສາ | Assessment, plan, follow-up, advice, final review, and signature |

All visible labels are Lao-first. English is retained only for technical identifiers or clinical codes such as EMR, ICD-10, LIS, Vital Signs, HN, VN, CBC, CRP, LFT, and medication route/frequency codes.

## Database Fields Needed

Phase 1 does not apply a migration. The following normalized fields are recommended for implementation.

### Patient Header

| Field | Notes |
| --- | --- |
| `patient_id` / `hn` | Stable patient identifier |
| `full_name`, `date_of_birth`, `gender` | Demographic identity |
| `blood_group` | Current verified blood group |
| `drug_allergy_summary` | Safety alert shown in the fixed header |
| `chronic_disease_summary` | Active chronic problems |
| `last_visit_at` | Derived from the latest completed encounter |

### Encounter

| Field | Notes |
| --- | --- |
| `visit_id`, `encounter_no`, `vn` | Encounter identifiers |
| `patient_id`, `department_id`, `provider_id` | Ownership links |
| `arrived_at`, `started_at`, `completed_at` | Workflow timestamps |
| `status` | `in_progress`, `completed`, `cancelled` |
| `signed_by`, `signed_at`, `locked_at` | Clinical signature and lock |
| `version_no` | Optimistic concurrency/version history |

### Assessment

| Field | Notes |
| --- | --- |
| `chief_complaint` | Required |
| `hpi` | Required current illness history |
| `physical_exam_json` | General, heart, lung, abdomen, neurological |
| `template_id` | Department template used |
| `template_version` | Reproducible template version |

### Vital Signs

| Field | Notes |
| --- | --- |
| `visit_id`, `recorded_by`, `recorded_at` | Nurse ownership and timestamp |
| `bp_systolic`, `bp_diastolic`, `temperature` | Core measurements |
| `pulse`, `respiratory_rate`, `spo2`, `weight` | Core measurements |
| `source` | `nurse`, device, or imported source |

Doctor EMR reads these fields but does not overwrite the original nurse record.

### Diagnoses

| Field | Notes |
| --- | --- |
| `diagnosis_id`, `visit_id` | Record identity |
| `icd10_code`, `display_lo` | Structured diagnosis |
| `diagnosis_type` | Primary or secondary |
| `rank_no` | Display/reporting order |
| `recorded_by`, `recorded_at` | Audit fields |

### Orders and LIS

| Field | Notes |
| --- | --- |
| `order_id`, `visit_id`, `patient_id` | Order identity and links |
| `category` | Laboratory or radiology |
| `item_code`, `item_name` | Ordered service |
| `priority`, `clinical_reason` | Request context |
| `status` | Draft, sent, accepted, in progress, resulted, cancelled |
| `external_order_no` | LIS correlation identifier |
| `requested_by`, `requested_at` | Ordering doctor and timestamp |

### Results

| Field | Notes |
| --- | --- |
| `result_id`, `order_id` | Result identity and order link |
| `analyte_code`, `analyte_name` | Test component |
| `value_text`, `value_numeric`, `unit` | Result value |
| `reference_range`, `abnormal_flag` | Clinical interpretation support |
| `status`, `verified_by`, `verified_at` | Result lifecycle |
| `source_payload_json` | Original LIS message for traceability |

### Medication

| Field | Notes |
| --- | --- |
| `medication_request_id`, `visit_id` | Request identity |
| `drug_id`, `drug_name` | Drug master link and display |
| `dose`, `route`, `frequency`, `duration` | Prescription instructions |
| `quantity`, `instructions` | Dispensing and patient directions |
| `allergy_check_status` | Safety-check outcome |
| `status`, `ordered_by`, `ordered_at` | Request lifecycle and audit |

### Encounter Summary

| Field | Notes |
| --- | --- |
| `assessment` | Doctor's final assessment |
| `plan` | Treatment and management plan |
| `follow_up_date` | Optional next visit date |
| `advice` | Patient instructions and safety-net advice |

### Draft and Audit

| Field | Notes |
| --- | --- |
| `draft_payload_json`, `draft_saved_at` | Recoverable in-progress work |
| `event_type`, `actor_id`, `event_at` | Audit event identity |
| `before_json`, `after_json` | Change history for signed records |

## Existing Data Compatibility

The current system already reads or writes `Visits.Lab_Orders_JSON`, `Visits.Prescription_JSON`, `Visits.Physical_Exam`, `Visits.Advice`, and `Visits.Follow_Up`. Phase 1 can map the new UI to these fields for a transitional release, but normalized diagnosis, order, result, and medication tables are recommended before production integration.

## Future LIS Integration

1. EMR creates a unique local `order_id` and sends patient, encounter, diagnosis, priority, clinical reason, and selected item codes.
2. LIS returns an `external_order_no`; both identifiers are stored for correlation.
3. LIS order acknowledgements update status from sent to accepted or rejected.
4. Specimen collection and processing update the same order lifecycle.
5. Verified results are received through an authenticated API or message queue and stored as structured result components.
6. EMR refreshes the result panel without requiring the doctor to open LIS.
7. Corrected or cancelled results are versioned; the original result and source payload remain auditable.
8. Result delivery must use role-based access, encrypted transport, retry/idempotency keys, and complete audit logging.

The Phase 1 prototype simulates this lifecycle locally. It generates an LIS order number and deterministic demo results only after an order is sent.

## Completion Validation

The local prototype requires:

- Chief complaint and current illness history
- At least one ICD-10 diagnosis
- Submission of any selected tests to LIS
- At least one medication
- Final assessment and treatment plan

After completion, form fields and clinical action buttons are locked while navigation tabs remain available for review.

## Local Test Scenario

1. Open `/opd/test`.
2. Confirm the selected patient header and automatically loaded history.
3. Enter the current illness history.
4. Search `Pneumonia` and add `J18.9`.
5. Select `CBC` and send the order.
6. Open the result tab and confirm `WBC 15.2` is flagged high.
7. Add `Paracetamol 500 mg`, `PO`, `TID`, `5 ມື້`.
8. Open the summary tab and complete the encounter.

Expected result: status changes to completed, the doctor signature is shown in the review panel, and editable controls are disabled.
