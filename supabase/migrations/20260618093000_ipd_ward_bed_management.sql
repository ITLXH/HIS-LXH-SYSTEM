-- IPD Ward / Bed Management extension.
-- This migration extends the existing HIS_One_* IPD tables instead of replacing them.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."HIS_One_Admissions" (
  "Admission_ID" TEXT PRIMARY KEY,
  "Patient_ID" TEXT,
  "Patient_Name" TEXT,
  "Admission_Date" TEXT,
  "Admission_Time" TEXT,
  "Admission_Type" TEXT,
  "Admitting_Doctor" TEXT,
  "Diagnosis_Admission" TEXT,
  "Ward_ID" TEXT,
  "Room_ID" TEXT,
  "Bed_ID" TEXT,
  "Deposit_Amount" NUMERIC,
  "Insurance_Info" TEXT,
  "Status" TEXT DEFAULT 'Admitted',
  "Discharge_Date" TEXT,
  "Discharge_Time" TEXT,
  "Discharge_Status" TEXT,
  "Discharge_Diagnosis" TEXT,
  "Notes" TEXT,
  "Follow_Up_Date" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."HIS_One_Admissions"
  ADD COLUMN IF NOT EXISTS "Updated_At" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "Source_Visit_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Admission_Source" TEXT DEFAULT 'OPD',
  ADD COLUMN IF NOT EXISTS "Initial_Assessment_Copied_At" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public."HIS_One_Wards" (
  "Ward_ID" TEXT PRIMARY KEY,
  "Ward_Name" TEXT NOT NULL,
  "Department" TEXT,
  "Floor" TEXT,
  "Capacity" INTEGER,
  "Status" TEXT DEFAULT 'Active',
  "Notes" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."HIS_One_Wards"
  ADD COLUMN IF NOT EXISTS "Ward_Type" TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS "Description" TEXT,
  ADD COLUMN IF NOT EXISTS "Updated_At" TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public."HIS_One_Rooms" (
  "Room_ID" TEXT PRIMARY KEY,
  "Ward_ID" TEXT,
  "Room_Number" TEXT NOT NULL,
  "Room_Type" TEXT,
  "Capacity" INTEGER,
  "Status" TEXT DEFAULT 'Active',
  "Notes" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."HIS_One_Rooms"
  ADD COLUMN IF NOT EXISTS "Floor" TEXT,
  ADD COLUMN IF NOT EXISTS "Daily_Charge" NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "Description" TEXT,
  ADD COLUMN IF NOT EXISTS "Updated_At" TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public."HIS_One_Beds" (
  "Bed_ID" TEXT PRIMARY KEY,
  "Room_ID" TEXT,
  "Ward_ID" TEXT,
  "Bed_Number" TEXT NOT NULL,
  "Status" TEXT DEFAULT 'Available',
  "Notes" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."HIS_One_Beds"
  ADD COLUMN IF NOT EXISTS "Bed_Type" TEXT DEFAULT 'Standard',
  ADD COLUMN IF NOT EXISTS "Bed_Status" TEXT DEFAULT 'Available',
  ADD COLUMN IF NOT EXISTS "Current_Patient_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Current_Patient_HN" TEXT,
  ADD COLUMN IF NOT EXISTS "Current_IPD_Admission_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Patient_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Patient_HN" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Patient_Name" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Phone" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_By" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_At" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Reserved_From" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Reserved_Until" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Reservation_Reason" TEXT,
  ADD COLUMN IF NOT EXISTS "Reservation_Notes" TEXT,
  ADD COLUMN IF NOT EXISTS "Last_Status_Updated_At" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "Updated_At" TIMESTAMPTZ DEFAULT NOW();

UPDATE public."HIS_One_Beds"
SET "Bed_Status" = COALESCE(NULLIF("Bed_Status", ''), NULLIF("Status", ''), 'Available')
WHERE "Bed_Status" IS NULL OR "Bed_Status" = '';

CREATE TABLE IF NOT EXISTS public."HIS_One_Bed_Movements" (
  "Movement_ID" TEXT PRIMARY KEY DEFAULT ('MOV' || replace(gen_random_uuid()::text, '-', '')),
  "IPD_Admission_ID" TEXT,
  "Patient_ID" TEXT,
  "Patient_HN" TEXT,
  "Movement_Type" TEXT NOT NULL,
  "From_Ward_ID" TEXT,
  "From_Room_ID" TEXT,
  "From_Bed_ID" TEXT,
  "To_Ward_ID" TEXT,
  "To_Room_ID" TEXT,
  "To_Bed_ID" TEXT,
  "Movement_Datetime" TIMESTAMPTZ DEFAULT NOW(),
  "Reason" TEXT,
  "Note" TEXT,
  "Created_By" TEXT,
  "Created_At" TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_his_one_beds_room_bed_number"
  ON public."HIS_One_Beds" ("Room_ID", lower("Bed_Number"));

CREATE INDEX IF NOT EXISTS "idx_his_one_beds_ward_id"
  ON public."HIS_One_Beds" ("Ward_ID");

CREATE INDEX IF NOT EXISTS "idx_his_one_beds_room_id"
  ON public."HIS_One_Beds" ("Room_ID");

CREATE INDEX IF NOT EXISTS "idx_his_one_beds_bed_status"
  ON public."HIS_One_Beds" ("Bed_Status");

CREATE INDEX IF NOT EXISTS "idx_his_one_beds_current_ipd_admission_id"
  ON public."HIS_One_Beds" ("Current_IPD_Admission_ID");

CREATE INDEX IF NOT EXISTS "idx_his_one_beds_reserved_patient_hn"
  ON public."HIS_One_Beds" ("Reserved_Patient_HN");

CREATE INDEX IF NOT EXISTS "idx_his_one_bed_movements_ipd_admission_id"
  ON public."HIS_One_Bed_Movements" ("IPD_Admission_ID");

ALTER TABLE public."HIS_One_Wards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Beds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Admissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Bed_Movements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_Admissions" ON public."HIS_One_Admissions";
CREATE POLICY "anon_all_Admissions" ON public."HIS_One_Admissions" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Wards" ON public."HIS_One_Wards";
CREATE POLICY "anon_all_Wards" ON public."HIS_One_Wards" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Rooms" ON public."HIS_One_Rooms";
CREATE POLICY "anon_all_Rooms" ON public."HIS_One_Rooms" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Beds" ON public."HIS_One_Beds";
CREATE POLICY "anon_all_Beds" ON public."HIS_One_Beds" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Bed_Movements" ON public."HIS_One_Bed_Movements";
CREATE POLICY "anon_all_Bed_Movements" ON public."HIS_One_Bed_Movements" FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public."HIS_One_Admissions" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Wards" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Rooms" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Beds" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Bed_Movements" TO anon, authenticated;
