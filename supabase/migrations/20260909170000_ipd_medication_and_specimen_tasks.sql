-- IPD nursing care tasks: medication administration record (MAR) and specimen collection.
-- Orders remain physician-owned; these append operational, dose-level nursing records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Medication_Administrations" (
  "Administration_ID" TEXT PRIMARY KEY DEFAULT ('MAR' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Order_ID" TEXT,
  "Scheduled_At" TIMESTAMPTZ NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'Scheduled'
    CHECK ("Status" IN ('Scheduled','Given','Held','Refused','Missed','Cancelled')),
  "Dose_Given" TEXT,
  "Route_Given" TEXT,
  "Administered_At" TIMESTAMPTZ,
  "Administered_By" TEXT,
  "Administered_By_ID" TEXT,
  "Reason" TEXT,
  "Notes" TEXT,
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Specimen_Tasks" (
  "Task_ID" TEXT PRIMARY KEY DEFAULT ('SPC' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Test_Name" TEXT NOT NULL,
  "Specimen_Type" TEXT NOT NULL DEFAULT 'Blood',
  "Specimen_ID" TEXT,
  "Scheduled_At" TIMESTAMPTZ NOT NULL,
  "Priority" TEXT NOT NULL DEFAULT 'Routine'
    CHECK ("Priority" IN ('Routine','Urgent','STAT')),
  "Status" TEXT NOT NULL DEFAULT 'Scheduled'
    CHECK ("Status" IN ('Scheduled','Collected','Sent','Received','Rejected','Cancelled')),
  "Collected_At" TIMESTAMPTZ,
  "Collected_By" TEXT,
  "Collected_By_ID" TEXT,
  "Sent_At" TIMESTAMPTZ,
  "Received_At" TIMESTAMPTZ,
  "Reason" TEXT,
  "Notes" TEXT,
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ipd_mar_admission_schedule"
  ON public."HIS_One_IPD_Medication_Administrations" ("Admission_ID", "Scheduled_At");
CREATE INDEX IF NOT EXISTS "idx_ipd_mar_order"
  ON public."HIS_One_IPD_Medication_Administrations" ("Order_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_specimen_admission_schedule"
  ON public."HIS_One_IPD_Specimen_Tasks" ("Admission_ID", "Scheduled_At");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ipd_specimen_id_unique"
  ON public."HIS_One_IPD_Specimen_Tasks" ("Specimen_ID") WHERE "Specimen_ID" IS NOT NULL;

ALTER TABLE public."HIS_One_IPD_Medication_Administrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Specimen_Tasks" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public."HIS_One_IPD_Medication_Administrations" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public."HIS_One_IPD_Specimen_Tasks" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public."HIS_One_IPD_Medication_Administrations" TO anon;
GRANT SELECT, INSERT, UPDATE ON public."HIS_One_IPD_Specimen_Tasks" TO anon;

DROP POLICY IF EXISTS his_ipd_mar_read ON public."HIS_One_IPD_Medication_Administrations";
CREATE POLICY his_ipd_mar_read ON public."HIS_One_IPD_Medication_Administrations"
  FOR SELECT TO authenticated USING (public.his_one_current_role() IN ('admin','doctor','nurse','pharmacy'));
DROP POLICY IF EXISTS his_ipd_mar_write ON public."HIS_One_IPD_Medication_Administrations";
CREATE POLICY his_ipd_mar_write ON public."HIS_One_IPD_Medication_Administrations"
  FOR INSERT TO authenticated WITH CHECK (public.his_one_current_role() IN ('admin','nurse'));
DROP POLICY IF EXISTS his_ipd_mar_update ON public."HIS_One_IPD_Medication_Administrations";
CREATE POLICY his_ipd_mar_update ON public."HIS_One_IPD_Medication_Administrations"
  FOR UPDATE TO authenticated USING (public.his_one_current_role() IN ('admin','nurse'))
  WITH CHECK (public.his_one_current_role() IN ('admin','nurse'));

DROP POLICY IF EXISTS his_ipd_specimen_read ON public."HIS_One_IPD_Specimen_Tasks";
CREATE POLICY his_ipd_specimen_read ON public."HIS_One_IPD_Specimen_Tasks"
  FOR SELECT TO authenticated USING (public.his_one_current_role() IN ('admin','doctor','nurse','lab'));
DROP POLICY IF EXISTS his_ipd_specimen_write ON public."HIS_One_IPD_Specimen_Tasks";
CREATE POLICY his_ipd_specimen_write ON public."HIS_One_IPD_Specimen_Tasks"
  FOR INSERT TO authenticated WITH CHECK (public.his_one_current_role() IN ('admin','doctor','nurse','lab'));
DROP POLICY IF EXISTS his_ipd_specimen_update ON public."HIS_One_IPD_Specimen_Tasks";
CREATE POLICY his_ipd_specimen_update ON public."HIS_One_IPD_Specimen_Tasks"
  FOR UPDATE TO authenticated USING (public.his_one_current_role() IN ('admin','nurse','lab'))
  WITH CHECK (public.his_one_current_role() IN ('admin','nurse','lab'));

-- Temporary parity with the current legacy Pages frontend. Remove with the anon bridge cutover.
DROP POLICY IF EXISTS his_ipd_mar_legacy_anon ON public."HIS_One_IPD_Medication_Administrations";
CREATE POLICY his_ipd_mar_legacy_anon ON public."HIS_One_IPD_Medication_Administrations"
  FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS his_ipd_specimen_legacy_anon ON public."HIS_One_IPD_Specimen_Tasks";
CREATE POLICY his_ipd_specimen_legacy_anon ON public."HIS_One_IPD_Specimen_Tasks"
  FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE public."HIS_One_IPD_Medication_Administrations" IS
  'Dose-level medication administration record. Rows are retained; UI does not hard-delete administrations.';
COMMENT ON TABLE public."HIS_One_IPD_Specimen_Tasks" IS
  'IPD specimen collection schedule and chain-of-custody status. Rows are retained; UI does not hard-delete tasks.';
