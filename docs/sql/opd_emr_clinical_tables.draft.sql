-- ============================================================
-- OPD EMR clinical data model
-- DRAFT ONLY - NOT APPLIED, NOT A MIGRATION
--
-- This file is intentionally stored under docs/sql. Move to
-- supabase/migrations only after the EMR module spec is approved.
--
-- Compatibility:
--   * Patient master stays in existing Patients / HIS_One_Patients.
--   * Encounter master stays in existing Visits / HIS_One_Visits.
--   * OPD vitals can stay in existing OPD_Vital_Signs.
--   * Visits.Prescription_JSON and Visits.Lab_Orders_JSON remain fallback
--     while structured EMR tables are introduced.
-- ============================================================

create extension if not exists pgcrypto;

-- MS-01: patient contacts beyond the current Patients row.
create table if not exists public.emr_patient_contacts (
  contact_id        text primary key default ('EMRCT' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  contact_type      text not null default 'emergency'
                   check (contact_type in ('emergency','guardian','family','payer','other')),
  full_name         text not null,
  relationship      text,
  phone             text,
  address           text,
  district          text,
  province          text,
  is_primary        boolean not null default false,
  created_at        timestamptz not null default now(),
  created_by        text,
  updated_at        timestamptz not null default now(),
  updated_by        text
);
create index if not exists idx_emr_patient_contacts_patient on public.emr_patient_contacts (patient_id);

-- MS-01 / MS-11: consent and privacy governance.
create table if not exists public.emr_patient_consents (
  consent_id        text primary key default ('EMRCS' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  consent_type      text not null
                   check (consent_type in ('treatment','data_collection','data_share','insurance','research','other')),
  purpose           text,
  status            text not null default 'active'
                   check (status in ('draft','active','withdrawn','expired')),
  captured_at       timestamptz not null default now(),
  captured_by       text,
  valid_from        timestamptz,
  valid_until       timestamptz,
  evidence_document_id text,
  note              text
);
create index if not exists idx_emr_patient_consents_patient on public.emr_patient_consents (patient_id, status);

-- MS-04: allergies, problems, and alert banners.
create table if not exists public.emr_allergies (
  allergy_id        text primary key default ('EMRAL' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  substance         text not null,
  allergy_type      text default 'drug'
                   check (allergy_type in ('drug','food','environment','other')),
  reaction          text,
  severity          text default 'unknown'
                   check (severity in ('mild','moderate','severe','life_threatening','unknown')),
  onset_date        date,
  status            text not null default 'active'
                   check (status in ('active','inactive','entered_in_error')),
  recorded_at       timestamptz not null default now(),
  recorded_by       text,
  reviewed_at       timestamptz,
  reviewed_by       text
);
create index if not exists idx_emr_allergies_patient on public.emr_allergies (patient_id, status);

create table if not exists public.emr_problem_list (
  problem_id        text primary key default ('EMRPR' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  icd10_code        text,
  problem_name      text not null,
  onset_date        date,
  status            text not null default 'active'
                   check (status in ('active','inactive','resolved','entered_in_error')),
  note              text,
  recorded_at       timestamptz not null default now(),
  recorded_by       text
);
create index if not exists idx_emr_problem_list_patient on public.emr_problem_list (patient_id, status);

create table if not exists public.emr_patient_alerts (
  alert_id          text primary key default ('EMRAT' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  visit_id          text,
  alert_type        text not null
                   check (alert_type in ('allergy','pregnancy','fall_risk','infection_control','critical_note','other')),
  severity          text default 'info'
                   check (severity in ('info','warning','critical')),
  alert_text        text not null,
  status            text not null default 'active'
                   check (status in ('active','inactive','resolved')),
  created_at        timestamptz not null default now(),
  created_by        text,
  resolved_at       timestamptz,
  resolved_by       text
);
create index if not exists idx_emr_patient_alerts_patient on public.emr_patient_alerts (patient_id, status);
create index if not exists idx_emr_patient_alerts_visit on public.emr_patient_alerts (visit_id);

-- MS-02: encounter metadata that should not overload Visits.
create table if not exists public.emr_encounter_meta (
  encounter_meta_id text primary key default ('EMREN' || replace(gen_random_uuid()::text, '-', '')),
  visit_id          text not null,
  patient_id        text not null,
  encounter_no      text,
  encounter_class   text not null default 'OPD'
                   check (encounter_class in ('OPD','IPD','OBSERVATION','EMERGENCY','VIRTUAL')),
  status            text not null default 'in_progress'
                   check (status in ('registered','triaged','in_exam','waiting_lab','ready_rx','completed','cancelled','locked')),
  department        text,
  room              text,
  provider_id       text,
  provider_name     text,
  nurse_id          text,
  nurse_name        text,
  disposition       text
                   check (disposition is null or disposition in ('home','observation','ipd_admit','referral','follow_up','cancelled')),
  registered_at     timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  locked_at         timestamptz,
  locked_by         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists idx_emr_encounter_meta_visit_unique on public.emr_encounter_meta (visit_id);
create index if not exists idx_emr_encounter_meta_patient on public.emr_encounter_meta (patient_id, registered_at desc);

-- MS-03: generic observations for vitals and structured clinical values
-- that do not already fit OPD_Vital_Signs.
create table if not exists public.emr_observations (
  observation_id    text primary key default ('EMROB' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  visit_id          text,
  category          text not null default 'vital'
                   check (category in ('vital','triage','exam','lab','score','other')),
  code              text,
  name              text not null,
  value_text        text,
  value_number      numeric,
  unit              text,
  reference_range   text,
  abnormal_flag     text check (abnormal_flag is null or abnormal_flag in ('low','high','critical_low','critical_high','normal','abnormal')),
  observed_at       timestamptz not null default now(),
  observed_by       text,
  source_module     text,
  source_record_id  text
);
create index if not exists idx_emr_observations_patient on public.emr_observations (patient_id, observed_at desc);
create index if not exists idx_emr_observations_visit on public.emr_observations (visit_id, observed_at desc);

-- MS-05: complete physician note in one row per note version.
create table if not exists public.emr_clinical_notes (
  note_id                   text primary key default ('EMRNT' || replace(gen_random_uuid()::text, '-', '')),
  visit_id                  text not null,
  patient_id                text not null,
  note_type                 text not null default 'doctor_opd'
                            check (note_type in ('doctor_opd','doctor_ipd','nursing','procedure','discharge','other')),
  chief_complaint           text,
  complaint_duration        text,
  complaint_severity        text check (complaint_severity is null or complaint_severity in ('mild','moderate','severe')),
  complaint_onset           text check (complaint_onset is null or complaint_onset in ('sudden','gradual','unknown')),
  hpi_narrative             text,
  associated_symptoms       text,
  aggravating_factors       text,
  relieving_factors         text,
  past_medical_history_json jsonb not null default '{}'::jsonb,
  family_history_json       jsonb not null default '{}'::jsonb,
  social_history_json       jsonb not null default '{}'::jsonb,
  review_of_systems_json    jsonb not null default '{}'::jsonb,
  physical_exam_json        jsonb not null default '{}'::jsonb,
  assessment_text           text,
  plan_text                 text,
  patient_advice            text,
  follow_up_date            date,
  follow_up_note            text,
  note_status               text not null default 'draft'
                            check (note_status in ('draft','signed','amended','voided')),
  signed_at                 timestamptz,
  signed_by                 text,
  created_at                timestamptz not null default now(),
  created_by                text,
  updated_at                timestamptz not null default now(),
  updated_by                text
);
create index if not exists idx_emr_clinical_notes_visit on public.emr_clinical_notes (visit_id, created_at desc);
create index if not exists idx_emr_clinical_notes_patient on public.emr_clinical_notes (patient_id, created_at desc);

-- MS-06: coded diagnosis rows.
create table if not exists public.emr_diagnoses (
  diagnosis_id      text primary key default ('EMRDX' || replace(gen_random_uuid()::text, '-', '')),
  visit_id          text not null,
  patient_id        text not null,
  note_id           text,
  icd10_code        text,
  description       text not null,
  diagnosis_type    text not null default 'primary'
                   check (diagnosis_type in ('primary','secondary','differential')),
  certainty         text not null default 'confirmed'
                   check (certainty in ('suspected','confirmed','ruled_out')),
  clinical_impression text,
  created_at        timestamptz not null default now(),
  created_by        text
);
create index if not exists idx_emr_diagnoses_visit on public.emr_diagnoses (visit_id);
create index if not exists idx_emr_diagnoses_patient on public.emr_diagnoses (patient_id, created_at desc);
create index if not exists idx_emr_diagnoses_icd10 on public.emr_diagnoses (icd10_code);

-- MS-07: unified order center for lab, radiology, procedures, referrals.
create table if not exists public.emr_orders (
  order_id          text primary key default ('EMROR' || replace(gen_random_uuid()::text, '-', '')),
  visit_id          text not null,
  patient_id        text not null,
  order_type        text not null
                   check (order_type in ('lab','radiology','procedure','referral','service')),
  item_code         text,
  item_name         text not null,
  clinical_reason   text,
  priority          text not null default 'routine'
                   check (priority in ('routine','urgent','stat')),
  target_system     text,
  external_order_id text,
  status            text not null default 'draft'
                   check (status in ('draft','ordered','sent','accepted','collected','received','running','completed','verified','released','cancelled','failed')),
  payload_json      jsonb not null default '{}'::jsonb,
  ack_json          jsonb not null default '{}'::jsonb,
  ordered_at        timestamptz,
  ordered_by        text,
  status_at         timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      text,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_emr_orders_visit on public.emr_orders (visit_id, created_at desc);
create index if not exists idx_emr_orders_patient on public.emr_orders (patient_id, created_at desc);
create index if not exists idx_emr_orders_status on public.emr_orders (status);
create index if not exists idx_emr_orders_external on public.emr_orders (target_system, external_order_id);

create table if not exists public.emr_order_specimens (
  specimen_id       text primary key default ('EMRSP' || replace(gen_random_uuid()::text, '-', '')),
  order_id          text not null references public.emr_orders(order_id) on delete cascade,
  specimen_type     text not null,
  specimen_code     text,
  collected_at      timestamptz,
  collected_by      text,
  received_at       timestamptz,
  received_by       text,
  rejection_reason  text,
  note              text
);
create index if not exists idx_emr_order_specimens_order on public.emr_order_specimens (order_id);

create table if not exists public.emr_order_results (
  result_id         text primary key default ('EMRRS' || replace(gen_random_uuid()::text, '-', '')),
  order_id          text not null references public.emr_orders(order_id) on delete cascade,
  patient_id        text not null,
  visit_id          text not null,
  result_status     text not null default 'preliminary'
                   check (result_status in ('preliminary','final','amended','cancelled')),
  result_json       jsonb not null default '{}'::jsonb,
  interpretation    text,
  abnormal_flag     text check (abnormal_flag is null or abnormal_flag in ('low','high','critical_low','critical_high','normal','abnormal')),
  result_pdf_document_id text,
  verified_by       text,
  verified_at       timestamptz,
  released_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_emr_order_results_order on public.emr_order_results (order_id);
create index if not exists idx_emr_order_results_patient on public.emr_order_results (patient_id, created_at desc);

-- MS-08: structured medication requests.
create table if not exists public.emr_medication_requests (
  medication_request_id text primary key default ('EMRMX' || replace(gen_random_uuid()::text, '-', '')),
  visit_id          text not null,
  patient_id        text not null,
  drug_id           text,
  drug_name         text not null,
  strength          text,
  form              text,
  dose              text not null,
  route             text,
  frequency         text not null,
  duration          text,
  quantity          numeric,
  quantity_unit     text,
  instruction       text,
  allergy_checked   boolean not null default false,
  interaction_checked boolean not null default false,
  duplicate_checked boolean not null default false,
  warning_json      jsonb not null default '{}'::jsonb,
  status            text not null default 'draft'
                   check (status in ('draft','prescribed','sent_to_pharmacy','dispensed','cancelled')),
  prescribed_at     timestamptz,
  prescribed_by     text,
  dispensed_at      timestamptz,
  dispensed_by      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_emr_medication_requests_visit on public.emr_medication_requests (visit_id, created_at desc);
create index if not exists idx_emr_medication_requests_patient on public.emr_medication_requests (patient_id, created_at desc);

-- MS-09: clinical documents and media.
create table if not exists public.emr_documents (
  document_id       text primary key default ('EMRDC' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  visit_id          text,
  order_id          text,
  result_id         text,
  document_type     text not null
                   check (document_type in ('lab_report','ecg','ultrasound','xray','referral','external_report','image','pdf','consent','other')),
  title             text,
  file_name         text not null,
  mime_type         text,
  storage_bucket    text,
  file_path         text not null,
  checksum_sha256   text,
  size_bytes        bigint,
  visibility        text not null default 'clinical'
                   check (visibility in ('clinical','restricted','administrative')),
  uploaded_at       timestamptz not null default now(),
  uploaded_by       text
);
create index if not exists idx_emr_documents_patient on public.emr_documents (patient_id, uploaded_at desc);
create index if not exists idx_emr_documents_visit on public.emr_documents (visit_id, uploaded_at desc);
create index if not exists idx_emr_documents_order on public.emr_documents (order_id);

-- MS-10: timeline and audit trail.
create table if not exists public.emr_timeline (
  timeline_id       text primary key default ('EMRTL' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  visit_id          text not null,
  event_time        timestamptz not null default now(),
  event_type        text not null,
  event_text        text not null,
  source_module     text,
  source_record_id  text,
  actor             text
);
create index if not exists idx_emr_timeline_visit on public.emr_timeline (visit_id, event_time desc);
create index if not exists idx_emr_timeline_patient on public.emr_timeline (patient_id, event_time desc);

create table if not exists public.emr_audit_events (
  audit_id          text primary key default ('EMRAU' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text,
  visit_id          text,
  table_name        text not null,
  record_id         text not null,
  action            text not null check (action in ('insert','update','delete','lock','unlock','export','view')),
  before_json       jsonb,
  after_json        jsonb,
  reason            text,
  actor             text,
  ip_address        text,
  user_agent        text,
  occurred_at       timestamptz not null default now()
);
create index if not exists idx_emr_audit_patient on public.emr_audit_events (patient_id, occurred_at desc);
create index if not exists idx_emr_audit_visit on public.emr_audit_events (visit_id, occurred_at desc);
create index if not exists idx_emr_audit_record on public.emr_audit_events (table_name, record_id);

-- MS-10 / MS-11: signatures and access controls.
create table if not exists public.emr_signatures (
  signature_id      text primary key default ('EMRSG' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  visit_id          text not null,
  signed_record_type text not null,
  signed_record_id  text not null,
  signature_status  text not null default 'signed'
                   check (signature_status in ('draft','signed','amended','voided')),
  signed_at         timestamptz not null default now(),
  signed_by         text not null,
  amendment_reason  text
);
create index if not exists idx_emr_signatures_visit on public.emr_signatures (visit_id, signed_at desc);

create table if not exists public.emr_access_grants (
  grant_id          text primary key default ('EMRAG' || replace(gen_random_uuid()::text, '-', '')),
  role_name         text not null,
  module_name       text not null,
  action_name       text not null,
  is_allowed        boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        text,
  unique (role_name, module_name, action_name)
);

create table if not exists public.emr_data_shares (
  data_share_id     text primary key default ('EMRSH' || replace(gen_random_uuid()::text, '-', '')),
  patient_id        text not null,
  visit_id          text,
  recipient         text not null,
  purpose           text not null,
  consent_id        text,
  exported_at       timestamptz not null default now(),
  exported_by       text,
  export_format     text,
  note              text
);
create index if not exists idx_emr_data_shares_patient on public.emr_data_shares (patient_id, exported_at desc);

-- Optional RLS placeholder. Policies should be tightened before production.
-- alter table public.emr_patient_contacts enable row level security;
-- alter table public.emr_patient_consents enable row level security;
-- alter table public.emr_allergies enable row level security;
-- alter table public.emr_problem_list enable row level security;
-- alter table public.emr_patient_alerts enable row level security;
-- alter table public.emr_encounter_meta enable row level security;
-- alter table public.emr_observations enable row level security;
-- alter table public.emr_clinical_notes enable row level security;
-- alter table public.emr_diagnoses enable row level security;
-- alter table public.emr_orders enable row level security;
-- alter table public.emr_order_specimens enable row level security;
-- alter table public.emr_order_results enable row level security;
-- alter table public.emr_medication_requests enable row level security;
-- alter table public.emr_documents enable row level security;
-- alter table public.emr_timeline enable row level security;
-- alter table public.emr_audit_events enable row level security;
-- alter table public.emr_signatures enable row level security;
-- alter table public.emr_access_grants enable row level security;
-- alter table public.emr_data_shares enable row level security;
