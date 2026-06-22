-- IPD Visits / Ward Rounds
-- Groups doctor/nurse rounds and procedures so each clinical action can be
-- traced back to the provider who created it during a specific visit.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Visits" (
  "Visit_ID" TEXT PRIMARY KEY DEFAULT ('IPDV' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Visit_Type" TEXT DEFAULT 'Doctor Round',
  "Visit_Datetime" TIMESTAMPTZ DEFAULT NOW(),
  "End_Datetime" TIMESTAMPTZ,
  "Provider_ID" TEXT,
  "Provider_Name" TEXT,
  "Provider_Role" TEXT,
  "Reason" TEXT,
  "Summary" TEXT,
  "Status" TEXT DEFAULT 'Open',
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ipd_visits_admission" ON public."HIS_One_IPD_Visits" ("Admission_ID", "Visit_Datetime" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_visits_provider" ON public."HIS_One_IPD_Visits" ("Provider_ID");

ALTER TABLE public."HIS_One_IPD_Visits" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_IPD_Visits" ON public."HIS_One_IPD_Visits";
CREATE POLICY "anon_all_IPD_Visits" ON public."HIS_One_IPD_Visits" FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public."HIS_One_IPD_Visits" TO anon, authenticated;

-- Link clinical actions back to a visit + provider for audit/traceability.
ALTER TABLE public."HIS_One_IPD_Doctor_Notes"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_Role" TEXT;

ALTER TABLE public."HIS_One_IPD_Nursing_Notes"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_Role" TEXT;

ALTER TABLE public."HIS_One_IPD_Vital_Signs"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_Role" TEXT;

ALTER TABLE public."HIS_One_IPD_Medication_Orders"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_Role" TEXT;

ALTER TABLE public."HIS_One_IPD_Radiology_Orders"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_Role" TEXT;

ALTER TABLE public."HIS_One_IPD_Procedures"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_Role" TEXT;

ALTER TABLE public."HIS_One_IPD_Billing_Items"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Provider_ID" TEXT;

CREATE INDEX IF NOT EXISTS "idx_ipd_doctor_notes_visit" ON public."HIS_One_IPD_Doctor_Notes" ("Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_nursing_notes_visit" ON public."HIS_One_IPD_Nursing_Notes" ("Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_vitals_visit_link" ON public."HIS_One_IPD_Vital_Signs" ("Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_med_orders_visit" ON public."HIS_One_IPD_Medication_Orders" ("Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_radiology_visit" ON public."HIS_One_IPD_Radiology_Orders" ("Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_procedures_visit" ON public."HIS_One_IPD_Procedures" ("Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_billing_visit" ON public."HIS_One_IPD_Billing_Items" ("Visit_ID");
