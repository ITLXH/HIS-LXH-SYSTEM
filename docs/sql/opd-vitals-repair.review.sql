-- REVIEW CANDIDATE ONLY. Not an automatically applied migration.
-- Run on an isolated staging project after verifying the connection destination.
-- Missing-table repair only: refuse to overwrite an existing table or policies.
-- See docs/SESSION_FIVE_POINT_REVIEW_2026-10-07.md for release gates.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $$
BEGIN
  IF to_regclass('public."HIS_One_OPD_Vital_Signs"') IS NOT NULL THEN
    RAISE EXCEPTION 'Vitals table already exists: inspect schema instead of replacing it';
  END IF;
  IF to_regprocedure('public.his_one_is_active_user()') IS NULL
    OR to_regprocedure('public.his_one_is_admin()') IS NULL
    OR to_regprocedure('public.his_one_current_role()') IS NULL
    OR to_regprocedure('public.his_one_can_table_write(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Auth helper prerequisites are missing';
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
CREATE INDEX idx_opd_vitals_visit ON public."HIS_One_OPD_Vital_Signs" ("Visit_ID", "Recorded_At" DESC);
CREATE INDEX idx_opd_vitals_patient ON public."HIS_One_OPD_Vital_Signs" ("Patient_ID", "Recorded_At" DESC);
ALTER TABLE public."HIS_One_OPD_Vital_Signs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HIS_One_OPD_Vital_Signs" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."HIS_One_OPD_Vital_Signs" TO authenticated, service_role;
CREATE POLICY his_staff_read ON public."HIS_One_OPD_Vital_Signs"
  FOR SELECT TO authenticated USING ((SELECT public.his_one_is_active_user()));
CREATE POLICY his_admin_all ON public."HIS_One_OPD_Vital_Signs"
  FOR ALL TO authenticated USING ((SELECT public.his_one_is_admin()))
  WITH CHECK ((SELECT public.his_one_is_admin()));
CREATE POLICY his_role_insert ON public."HIS_One_OPD_Vital_Signs"
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.his_one_current_role()) = ANY (ARRAY['doctor','nurse']::text[]));
CREATE POLICY his_role_update ON public."HIS_One_OPD_Vital_Signs"
  FOR UPDATE TO authenticated USING ((SELECT public.his_one_current_role()) = ANY (ARRAY['doctor','nurse']::text[]))
  WITH CHECK ((SELECT public.his_one_current_role()) = ANY (ARRAY['doctor','nurse']::text[]));
CREATE POLICY his_action_insert ON public."HIS_One_OPD_Vital_Signs" AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','insert')));
CREATE POLICY his_action_update ON public."HIS_One_OPD_Vital_Signs" AS RESTRICTIVE
  FOR UPDATE TO authenticated USING ((SELECT public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','update')))
  WITH CHECK ((SELECT public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','update')));
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Rollback after writes: revert application release and retain this clinical table.
-- Do not DROP the table after staff have recorded vitals.
