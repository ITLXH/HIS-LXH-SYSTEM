-- OPD Follow-up / Observation workflow.
-- This is intentionally separate from HIS_One_Admissions/IPD beds/census.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.opd_observations (
  observation_id TEXT PRIMARY KEY DEFAULT ('OBS' || replace(gen_random_uuid()::text, '-', '')),
  visit_id TEXT,
  hn TEXT,
  patient_id TEXT,
  doctor_id TEXT,
  start_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_datetime TIMESTAMPTZ,
  duration_hours NUMERIC(8,2) DEFAULT 0,
  diagnosis TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ipd_admission_id TEXT,
  converted_at TIMESTAMPTZ,
  CONSTRAINT opd_observations_status_check CHECK (
    status IN ('WAITING','UNDER_OBSERVATION','COMPLETED','TRANSFER_TO_IPD','DISCHARGED')
  )
);

CREATE TABLE IF NOT EXISTS public.opd_observation_notes (
  id TEXT PRIMARY KEY DEFAULT ('OBSN' || replace(gen_random_uuid()::text, '-', '')),
  observation_id TEXT NOT NULL REFERENCES public.opd_observations(observation_id) ON DELETE CASCADE,
  note_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note_type TEXT NOT NULL,
  note_text TEXT,
  temp TEXT,
  bp TEXT,
  pulse TEXT,
  rr TEXT,
  spo2 TEXT,
  pain_score TEXT,
  medication TEXT,
  procedure_name TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opd_observation_notes_type_check CHECK (
    note_type IN ('VITAL_SIGN','DOCTOR_NOTE','NURSING_NOTE','MEDICATION','PROCEDURE')
  )
);

CREATE INDEX IF NOT EXISTS idx_opd_observations_visit_id ON public.opd_observations(visit_id);
CREATE INDEX IF NOT EXISTS idx_opd_observations_hn ON public.opd_observations(hn);
CREATE INDEX IF NOT EXISTS idx_opd_observations_patient_id ON public.opd_observations(patient_id);
CREATE INDEX IF NOT EXISTS idx_opd_observations_status ON public.opd_observations(status);
CREATE INDEX IF NOT EXISTS idx_opd_observations_start ON public.opd_observations(start_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_opd_observation_notes_observation ON public.opd_observation_notes(observation_id, note_datetime DESC);

CREATE OR REPLACE FUNCTION public.set_opd_observation_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.duration_hours = ROUND(
    EXTRACT(EPOCH FROM (COALESCE(NEW.end_datetime, NOW()) - NEW.start_datetime)) / 3600.0,
    2
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_opd_observation_duration ON public.opd_observations;
CREATE TRIGGER trg_set_opd_observation_duration
BEFORE INSERT OR UPDATE ON public.opd_observations
FOR EACH ROW EXECUTE FUNCTION public.set_opd_observation_duration();

ALTER TABLE public.opd_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opd_observation_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_opd_observations" ON public.opd_observations;
CREATE POLICY "anon_all_opd_observations" ON public.opd_observations
FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_opd_observation_notes" ON public.opd_observation_notes;
CREATE POLICY "anon_all_opd_observation_notes" ON public.opd_observation_notes
FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.opd_observations TO anon, authenticated;
GRANT ALL ON TABLE public.opd_observation_notes TO anon, authenticated;
