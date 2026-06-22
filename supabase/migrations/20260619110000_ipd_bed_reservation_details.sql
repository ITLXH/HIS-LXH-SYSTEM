-- Add patient reservation details to IPD beds.
-- Existing deployments already applied the base ward/bed migration, so this
-- migration carries the newly added reservation fields forward safely.

ALTER TABLE public."HIS_One_Beds"
  ADD COLUMN IF NOT EXISTS "Reserved_Patient_ID" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Patient_HN" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Patient_Name" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_Phone" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_By" TEXT,
  ADD COLUMN IF NOT EXISTS "Reserved_At" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Reserved_From" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Reserved_Until" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "Reservation_Reason" TEXT,
  ADD COLUMN IF NOT EXISTS "Reservation_Notes" TEXT;

CREATE INDEX IF NOT EXISTS "idx_his_one_beds_reserved_patient_hn"
  ON public."HIS_One_Beds" ("Reserved_Patient_HN");
