-- Add assistant/admitting nurse column to IPD admissions.
ALTER TABLE public."HIS_One_Admissions"
  ADD COLUMN IF NOT EXISTS "Admitting_Nurse" TEXT;
