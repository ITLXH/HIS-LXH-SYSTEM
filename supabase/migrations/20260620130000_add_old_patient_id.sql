ALTER TABLE public."HIS_One_Patients"
  ADD COLUMN IF NOT EXISTS "Old_Patient_ID" TEXT;

CREATE INDEX IF NOT EXISTS "idx_HIS_One_Patients_Old_Patient_ID"
  ON public."HIS_One_Patients" ("Old_Patient_ID");
