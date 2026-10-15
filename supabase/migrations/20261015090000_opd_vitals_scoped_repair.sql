-- REVIEW / STAGING FIRST. Never apply the broad legacy anon clinical migration.
-- Deliberately fails on an existing table: inspect its schema and policies first.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $$ BEGIN
 IF to_regclass('public."HIS_One_OPD_Vital_Signs"') IS NOT NULL THEN
  RAISE EXCEPTION 'OPD_VITAL_TABLE_EXISTS_REVIEW_REQUIRED';
 END IF;
 IF to_regclass('public."HIS_One_Visits"') IS NULL
 OR to_regprocedure('public.his_one_is_active_user()') IS NULL
 OR to_regprocedure('public.his_one_can_table_write(text,text)') IS NULL THEN
  RAISE EXCEPTION 'OPD_VITAL_AUTH_OR_VISIT_SCHEMA_NOT_READY';
 END IF;
END $$;
CREATE TABLE public."HIS_One_OPD_Vital_Signs" (
  "Vital_ID" TEXT PRIMARY KEY DEFAULT ('OPDVS' || replace(gen_random_uuid()::text, '-', '')),
  "Visit_ID" TEXT NOT NULL,
  "Patient_ID" TEXT,
  "Recorded_At" TIMESTAMPTZ DEFAULT NOW(),
  "Temperature" NUMERIC,
  "BP_Systolic" INTEGER,
  "BP_Diastolic" INTEGER,
  "Pulse" INTEGER,
  "Respiration" INTEGER,
  "SpO2" INTEGER,
  "Weight" NUMERIC,
  "Height" NUMERIC,
  "BMI" NUMERIC,
  "Pain_Score" INTEGER,
  "Symptoms" TEXT,
  "Notes" TEXT,
  "Recorded_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public."HIS_One_OPD_Vital_Signs" ENABLE ROW LEVEL SECURITY;
-- Explicit grants override any database default privileges on this NEW table only.
REVOKE ALL ON public."HIS_One_OPD_Vital_Signs" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public."HIS_One_OPD_Vital_Signs" TO authenticated;
GRANT ALL ON public."HIS_One_OPD_Vital_Signs" TO service_role;
CREATE POLICY opd_vital_staff_read ON public."HIS_One_OPD_Vital_Signs"
 FOR SELECT TO authenticated USING ((SELECT public.his_one_is_active_user()));
CREATE POLICY opd_vital_staff_insert ON public."HIS_One_OPD_Vital_Signs"
 FOR INSERT TO authenticated WITH CHECK (
 (SELECT public.his_one_is_active_user())
 AND (SELECT public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','insert'))
 AND EXISTS (SELECT 1 FROM public."HIS_One_Visits" v
 WHERE v."Visit_ID" = "HIS_One_OPD_Vital_Signs"."Visit_ID"
 AND v."Patient_ID" = "HIS_One_OPD_Vital_Signs"."Patient_ID"));
CREATE POLICY opd_vital_staff_update ON public."HIS_One_OPD_Vital_Signs"
 FOR UPDATE TO authenticated USING (
 (SELECT public.his_one_is_active_user())
 AND (SELECT public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','update')))
 WITH CHECK (
 (SELECT public.his_one_is_active_user())
 AND (SELECT public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','update'))
 AND EXISTS (SELECT 1 FROM public."HIS_One_Visits" v
 WHERE v."Visit_ID" = "HIS_One_OPD_Vital_Signs"."Visit_ID"
 AND v."Patient_ID" = "HIS_One_OPD_Vital_Signs"."Patient_ID"));
CREATE INDEX idx_opd_vitals_visit ON public."HIS_One_OPD_Vital_Signs" ("Visit_ID", "Recorded_At" DESC);
CREATE INDEX idx_opd_vitals_patient ON public."HIS_One_OPD_Vital_Signs" ("Patient_ID", "Recorded_At" DESC);
NOTIFY pgrst, 'reload schema';
COMMIT;