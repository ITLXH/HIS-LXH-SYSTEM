-- IPD Clinical Chart extension.
-- Additive Phase 2 tables for patient IPD chart CRUD.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."HIS_One_OPD_Vital_Signs" (
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

ALTER TABLE public."HIS_One_OPD_Vital_Signs"
  ADD COLUMN IF NOT EXISTS "Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Patient_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Recorded_At" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "Temperature" NUMERIC,
  ADD COLUMN IF NOT EXISTS "BP_Systolic" INTEGER,
  ADD COLUMN IF NOT EXISTS "BP_Diastolic" INTEGER,
  ADD COLUMN IF NOT EXISTS "Pulse" INTEGER,
  ADD COLUMN IF NOT EXISTS "Respiration" INTEGER,
  ADD COLUMN IF NOT EXISTS "SpO2" INTEGER,
  ADD COLUMN IF NOT EXISTS "Weight" NUMERIC,
  ADD COLUMN IF NOT EXISTS "Height" NUMERIC,
  ADD COLUMN IF NOT EXISTS "BMI" NUMERIC,
  ADD COLUMN IF NOT EXISTS "Pain_Score" INTEGER,
  ADD COLUMN IF NOT EXISTS "Symptoms" TEXT,
  ADD COLUMN IF NOT EXISTS "Notes" TEXT,
  ADD COLUMN IF NOT EXISTS "Recorded_By" TEXT,
  ADD COLUMN IF NOT EXISTS "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "Updated_At" TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Doctor_Notes" (
  "Note_ID" TEXT PRIMARY KEY DEFAULT ('DN' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Note_Datetime" TIMESTAMPTZ DEFAULT NOW(),
  "Subjective" TEXT,
  "Objective" TEXT,
  "Assessment" TEXT,
  "Plan" TEXT,
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Nursing_Notes" (
  "Note_ID" TEXT PRIMARY KEY DEFAULT ('NN' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Note_Datetime" TIMESTAMPTZ DEFAULT NOW(),
  "Shift" TEXT,
  "Notes" TEXT,
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Vital_Signs" (
  "Vital_ID" TEXT PRIMARY KEY DEFAULT ('VS' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
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
  "Notes" TEXT,
  "Recorded_By" TEXT,
  "Source_Visit_ID" TEXT,
  "Source_Vital_ID" TEXT,
  "Source_Type" TEXT DEFAULT 'Manual',
  "Is_Initial_Assessment" BOOLEAN DEFAULT FALSE,
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."HIS_One_IPD_Vital_Signs"
  ADD COLUMN IF NOT EXISTS "Weight" NUMERIC,
  ADD COLUMN IF NOT EXISTS "Height" NUMERIC,
  ADD COLUMN IF NOT EXISTS "BMI" NUMERIC,
  ADD COLUMN IF NOT EXISTS "Notes" TEXT,
  ADD COLUMN IF NOT EXISTS "Recorded_By" TEXT,
  ADD COLUMN IF NOT EXISTS "Source_Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Source_Vital_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Source_Type" TEXT DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS "Is_Initial_Assessment" BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Medication_Orders" (
  "Order_ID" TEXT PRIMARY KEY DEFAULT ('MO' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Ordered_At" TIMESTAMPTZ DEFAULT NOW(),
  "Drug" TEXT NOT NULL,
  "Dose" TEXT,
  "Frequency" TEXT,
  "Route" TEXT,
  "Duration" TEXT,
  "Status" TEXT DEFAULT 'Active',
  "Notes" TEXT,
  "Ordered_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Radiology_Orders" (
  "Radiology_ID" TEXT PRIMARY KEY DEFAULT ('RAD' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Request_Datetime" TIMESTAMPTZ DEFAULT NOW(),
  "Imaging_Type" TEXT,
  "Body_Part" TEXT,
  "Request_Note" TEXT,
  "Result_Text" TEXT,
  "Status" TEXT DEFAULT 'Requested',
  "Ordered_By" TEXT,
  "Reported_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Procedures" (
  "Procedure_ID" TEXT PRIMARY KEY DEFAULT ('PROC' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Procedure_Datetime" TIMESTAMPTZ DEFAULT NOW(),
  "Procedure_Name" TEXT NOT NULL,
  "Performer" TEXT,
  "Findings" TEXT,
  "Status" TEXT DEFAULT 'Completed',
  "Notes" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Billing_Items" (
  "Billing_ID" TEXT PRIMARY KEY DEFAULT ('BILL' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL,
  "Item_Date" DATE DEFAULT CURRENT_DATE,
  "Item_Type" TEXT,
  "Description" TEXT NOT NULL,
  "Quantity" NUMERIC DEFAULT 1,
  "Unit_Price" NUMERIC DEFAULT 0,
  "Amount" NUMERIC DEFAULT 0,
  "Status" TEXT DEFAULT 'Unpaid',
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."HIS_One_IPD_Discharge_Summaries" (
  "Summary_ID" TEXT PRIMARY KEY DEFAULT ('DS' || replace(gen_random_uuid()::text, '-', '')),
  "Admission_ID" TEXT NOT NULL UNIQUE,
  "Final_Diagnosis" TEXT,
  "Hospital_Course" TEXT,
  "Treatment_Given" TEXT,
  "Condition_On_Discharge" TEXT,
  "Discharge_Medications" TEXT,
  "Follow_Up" TEXT,
  "Instructions" TEXT,
  "Discharge_Date" TEXT,
  "Discharge_Time" TEXT,
  "Prepared_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW(),
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_ipd_doctor_notes_admission" ON public."HIS_One_IPD_Doctor_Notes" ("Admission_ID", "Note_Datetime" DESC);
CREATE INDEX IF NOT EXISTS "idx_opd_vitals_visit" ON public."HIS_One_OPD_Vital_Signs" ("Visit_ID", "Recorded_At" DESC);
CREATE INDEX IF NOT EXISTS "idx_opd_vitals_patient" ON public."HIS_One_OPD_Vital_Signs" ("Patient_ID", "Recorded_At" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_nursing_notes_admission" ON public."HIS_One_IPD_Nursing_Notes" ("Admission_ID", "Note_Datetime" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_vitals_admission" ON public."HIS_One_IPD_Vital_Signs" ("Admission_ID", "Recorded_At" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_vitals_source_visit" ON public."HIS_One_IPD_Vital_Signs" ("Source_Visit_ID");
CREATE INDEX IF NOT EXISTS "idx_ipd_med_orders_admission" ON public."HIS_One_IPD_Medication_Orders" ("Admission_ID", "Ordered_At" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_radiology_admission" ON public."HIS_One_IPD_Radiology_Orders" ("Admission_ID", "Request_Datetime" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_procedures_admission" ON public."HIS_One_IPD_Procedures" ("Admission_ID", "Procedure_Datetime" DESC);
CREATE INDEX IF NOT EXISTS "idx_ipd_billing_admission" ON public."HIS_One_IPD_Billing_Items" ("Admission_ID", "Item_Date" DESC);

ALTER TABLE public."HIS_One_OPD_Vital_Signs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Doctor_Notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Nursing_Notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Vital_Signs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Medication_Orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Radiology_Orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Procedures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Billing_Items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_IPD_Discharge_Summaries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_OPD_Vital_Signs" ON public."HIS_One_OPD_Vital_Signs";
CREATE POLICY "anon_all_OPD_Vital_Signs" ON public."HIS_One_OPD_Vital_Signs" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Doctor_Notes" ON public."HIS_One_IPD_Doctor_Notes";
CREATE POLICY "anon_all_IPD_Doctor_Notes" ON public."HIS_One_IPD_Doctor_Notes" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Nursing_Notes" ON public."HIS_One_IPD_Nursing_Notes";
CREATE POLICY "anon_all_IPD_Nursing_Notes" ON public."HIS_One_IPD_Nursing_Notes" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Vital_Signs" ON public."HIS_One_IPD_Vital_Signs";
CREATE POLICY "anon_all_IPD_Vital_Signs" ON public."HIS_One_IPD_Vital_Signs" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Medication_Orders" ON public."HIS_One_IPD_Medication_Orders";
CREATE POLICY "anon_all_IPD_Medication_Orders" ON public."HIS_One_IPD_Medication_Orders" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Radiology_Orders" ON public."HIS_One_IPD_Radiology_Orders";
CREATE POLICY "anon_all_IPD_Radiology_Orders" ON public."HIS_One_IPD_Radiology_Orders" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Procedures" ON public."HIS_One_IPD_Procedures";
CREATE POLICY "anon_all_IPD_Procedures" ON public."HIS_One_IPD_Procedures" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Billing_Items" ON public."HIS_One_IPD_Billing_Items";
CREATE POLICY "anon_all_IPD_Billing_Items" ON public."HIS_One_IPD_Billing_Items" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_IPD_Discharge_Summaries" ON public."HIS_One_IPD_Discharge_Summaries";
CREATE POLICY "anon_all_IPD_Discharge_Summaries" ON public."HIS_One_IPD_Discharge_Summaries" FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public."HIS_One_OPD_Vital_Signs" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Doctor_Notes" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Nursing_Notes" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Vital_Signs" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Medication_Orders" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Radiology_Orders" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Procedures" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Billing_Items" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_IPD_Discharge_Summaries" TO anon, authenticated;
