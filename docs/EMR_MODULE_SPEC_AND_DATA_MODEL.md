# EMR Module Specification and Data Model

Local draft for Luckxay Hospital HIS. This file is a working specification only; it is not a committed or deployed database change.

## Design Baseline

EMR data should be split by clinical meaning, not kept only as one free-text note. The model below follows these stable concepts:

- Patient = demographic and administrative information about the person receiving care.
- Encounter = one healthcare interaction such as OPD, emergency, observation, IPD admission, or virtual visit.
- Observation = vitals, measurements, lab values, and other simple clinical assertions.
- ServiceRequest = a request for lab, imaging, procedure, referral, or other clinical service.
- DiagnosticReport = the grouped findings and interpretation from diagnostic testing.
- MedicationRequest = a prescription/order including supply and administration instructions.

References used: HL7 FHIR R4 Patient, Encounter, Observation, ServiceRequest, DiagnosticReport, MedicationRequest; WHO Lao PDR HIS strengthening page; Lao electronic data protection summary from DLA Piper.

## What EMR Must Have

### MS-01 Patient Master

Purpose: identify the patient safely and connect every visit, order, result, and document to the right person.

Required data:

| Field group | Store |
|---|---|
| Identifiers | HN, old HN, national ID/passport if used, hospital branch/site |
| Name | title, first name, last name, local script name, English name if available |
| Demographics | DOB, calculated age, sex/gender, nationality, occupation, blood type |
| Contact | phone, email, village/address, district, province |
| Emergency contact | name, relationship, phone, address |
| Payer | cash/insurance/corporate, insurance code, organization |
| Safety summary | drug allergy summary, food allergy summary, underlying disease summary |
| Governance | consent status, consent date/time, created_by, updated_by, active/inactive |

Main storage: existing `Patients`, plus optional `emr_patient_contacts`, `emr_patient_consents`, `emr_patient_alerts`.

### MS-02 Encounter / Visit

Purpose: one visit container that links clinical notes, vitals, orders, prescriptions, payments, and status.

Required data:

| Field group | Store |
|---|---|
| Identifiers | Visit_ID/VN, patient_id/HN, encounter_no |
| Time | registration date/time, start time, completed time, locked time |
| Service context | OPD/IPD/Observation/Emergency, department, room, provider, nurse |
| Status | registered, triaged, in_exam, waiting_lab, ready_rx, completed, cancelled |
| Disposition | home, observation, IPD admit, referral, follow-up |
| Billing link | payer, invoice/payment status when relevant |
| Signature | locked_by, locked_at, signed_by, signed_at |

Main storage: existing `Visits`, plus optional `emr_encounter_meta` and `emr_signatures`.

### MS-03 Vitals and Triage

Purpose: capture clinical measurements before/during examination and make trends reportable.

Required data:

| Field group | Store |
|---|---|
| Measured values | BP systolic/diastolic, temperature, pulse, respiratory rate, SpO2 |
| Body values | weight, height, BMI |
| Clinical scale | pain score, consciousness/AVPU, triage acuity |
| Context | recorded_at, recorded_by, device/manual, note |

Main storage: existing `OPD_Vital_Signs` / IPD vitals, plus `emr_observations` for generic measurements.

### MS-04 Allergy, Alerts, and Problems

Purpose: warn clinicians before ordering medication or procedures.

Required data:

| Field group | Store |
|---|---|
| Allergy | substance, type, reaction, severity, onset/date, status |
| Problem list | condition/ICD-10, active/inactive, onset, note |
| Clinical alerts | pregnancy, fall risk, infection control, critical note |
| Audit | created_by, updated_by, reviewed_at |

Main storage: existing patient allergy fields, plus `emr_allergies`, `emr_problem_list`, `emr_patient_alerts`.

### MS-05 Clinical Note

Purpose: record the doctor's medical reasoning in structured sections.

Required data:

| Section | Store |
|---|---|
| Chief complaint | complaint, duration, severity, onset |
| HPI | narrative, associated symptoms, aggravating factors, relieving factors |
| Past medical history | DM, HTN, CKD, asthma, heart disease, cancer, TB, HIV, other |
| Family history | father, mother, sibling, genetic disease |
| Social history | smoking, alcohol, drug use, occupation, exercise |
| Review of systems | general, respiratory, cardiovascular, GI, GU, neurology, skin, MSK findings |
| Physical exam | general, HEENT, neck, chest, heart, abdomen, extremities, neuro, skin |
| Assessment | impression, risk level, differential diagnosis |
| Plan | medication, lab, radiology, procedure, referral, advice, follow-up |

Main storage: `emr_clinical_notes` with JSONB for ROS and PE, or split tables if reporting needs become strict.

### MS-06 Diagnosis

Purpose: store coded diagnosis for continuity, reporting, and billing.

Required data:

| Field group | Store |
|---|---|
| Diagnosis | ICD-10 code, description, primary/secondary/differential |
| Certainty | suspected, confirmed, ruled_out |
| Context | visit_id, patient_id, provider, created_at |

Main storage: `emr_diagnoses`.

### MS-07 Orders and LIS

Purpose: create one order center for lab, radiology, procedure, and referral. Lab order status is mirrored from LIS.

Required data:

| Field group | Store |
|---|---|
| Request | order_id, order_type, item_code, item_name, priority, clinical_reason |
| LIS | lis_order_id, target_system, payload_json, ack_json, status |
| Specimen | specimen_type, collected_at, collected_by, received_at |
| Result | result_json, abnormal_flag, verified_by, verified_at, released_at, result_pdf |
| Cancellation | cancelled_by, cancelled_at, cancel_reason |

Main storage: `emr_orders`, `emr_order_specimens`, `emr_order_results`.

### MS-08 Medication and Prescription

Purpose: store medication orders safely and support allergy/duplicate checks.

Required data:

| Field group | Store |
|---|---|
| Drug | drug_id, drug_name, strength, form |
| Instruction | dose, route, frequency, duration, quantity, unit |
| Safety | allergy_checked, interaction_checked, duplicate_checked, warning_json |
| Workflow | order_status, pharmacy_status, dispensed_at, dispensed_by |
| Signature | prescribed_by, prescribed_at |

Main storage: existing `Visits.Prescription_JSON` as fallback, plus `emr_medication_requests`.

### MS-09 Documents and Media

Purpose: attach external evidence without losing provenance.

Required data:

| Field group | Store |
|---|---|
| Metadata | document_id, type, title, file_name, mime_type |
| Storage | storage_bucket, file_path, checksum, size_bytes |
| Link | patient_id, visit_id, order_id, result_id |
| Audit | uploaded_by, uploaded_at, visibility |

Main storage: `emr_documents`.

### MS-10 Timeline and Audit

Purpose: make the visit story traceable and support medico-legal review.

Required data:

| Field group | Store |
|---|---|
| Timeline | event_type, event_text, event_time, actor, source_module |
| Audit | table_name, record_id, action, before_json, after_json, ip/user_agent |
| Locking | locked_at, locked_by, unlock_reason when corrected |

Main storage: `emr_timeline`, `emr_audit_events`, `emr_signatures`.

### MS-11 Privacy, Consent, and Access

Purpose: protect health data and meet Lao electronic data protection expectations.

Required data:

| Field group | Store |
|---|---|
| Consent | consent_type, purpose, status, captured_at, captured_by |
| Access | role, module, action, allowed/denied |
| Retention | retention_policy, archive_at, destroy_at where applicable |
| Export/share | recipient, purpose, consent_reference, exported_at |

Main storage: `emr_patient_consents`, `emr_access_grants`, `emr_data_shares`.

## Minimal OPD Close Rules

A visit should not be locked unless:

- Patient identity is present: HN, name, DOB/age, sex.
- Encounter is present: VN/Visit_ID, date/time, department, provider.
- Vitals are present or explicitly marked unavailable with reason.
- Allergy status is reviewed.
- Clinical note has at least CC, assessment/diagnosis, and plan.
- Orders have clear status: draft, sent, cancelled, or resulted.
- Medication order has dose, frequency, duration, quantity, and safety checks when prescribed.
- Disposition is selected.
- Doctor signature/lock is recorded.

## Integration Rules

- HIS owns patient, encounter, medication request, clinical note, document index, timeline, and audit.
- LIS owns analytical lab processing and returns status/results.
- HIS stores LIS order ID, acknowledgement, status, structured results, and PDF/report link.
- Do not store only PDF results; store structured result values for search, trends, and clinical decision support.
- Keep old `Visits.Prescription_JSON` and `Visits.Lab_Orders_JSON` as fallback until the new tables are live and migrated.

## Implementation Notes

- The current `OPD Test` screen is local demo UI and does not apply migrations.
- SQL draft: `docs/sql/opd_emr_clinical_tables.draft.sql`.
- Do not move SQL into `supabase/migrations/` until the data model is approved.
- Do not commit or push unless explicitly requested.
