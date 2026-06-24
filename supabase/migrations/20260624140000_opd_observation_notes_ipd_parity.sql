-- OPD Observation notes — bring schema to parity with IPD clinical tables
-- so the OPD Observation Doctor / Nursing / Vital modals can capture the
-- same structured fields as the IPD chart (SOAP, shift, BMI, Consciousness, ...).

-- Provider tracking (same as IPD action tables)
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS provider_id   TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS provider_role TEXT;

-- Doctor Note (SOAP+)
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS visit_type     TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS diagnosis      TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS subjective     TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS objective      TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS assessment     TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS plan           TEXT;

-- Nursing Note (rich shift fields)
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS shift                 TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS patient_condition     TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS observation_text      TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS nursing_care_given    TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS response_to_treatment TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS intake                TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS output                TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS fall_risk             TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS allergy_alert         TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS medication_given      TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS procedure_done        TEXT;

-- Vital signs (IPD-style breakdown)
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS bp_systolic   TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS bp_diastolic  TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS weight        TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS height        TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS bmi           TEXT;
ALTER TABLE public.opd_observation_notes ADD COLUMN IF NOT EXISTS consciousness TEXT;

-- Keep grants in sync (no-op if already present).
GRANT ALL ON TABLE public.opd_observation_notes TO anon, authenticated;
