-- Simplify IPD chart to a Timeline-only EMR view, with richer fields on the
-- three primary entry types: Doctor SOAP Note, Nursing Shift Note, Vital Signs.

-- Doctor SOAP Note — add Visit_Type, Diagnosis, Chief_Complaint.
ALTER TABLE public."HIS_One_IPD_Doctor_Notes"
  ADD COLUMN IF NOT EXISTS "Visit_Type"     TEXT,
  ADD COLUMN IF NOT EXISTS "Diagnosis"      TEXT,
  ADD COLUMN IF NOT EXISTS "Chief_Complaint" TEXT;

-- Nursing Shift Note — add the structured fields a ward nurse documents per shift.
ALTER TABLE public."HIS_One_IPD_Nursing_Notes"
  ADD COLUMN IF NOT EXISTS "Patient_Condition"   TEXT,
  ADD COLUMN IF NOT EXISTS "Observation"         TEXT,
  ADD COLUMN IF NOT EXISTS "Nursing_Care_Given"  TEXT,
  ADD COLUMN IF NOT EXISTS "Response_To_Treatment" TEXT,
  ADD COLUMN IF NOT EXISTS "Intake"              TEXT,
  ADD COLUMN IF NOT EXISTS "Output"              TEXT,
  ADD COLUMN IF NOT EXISTS "Pain_Score"          INTEGER,
  ADD COLUMN IF NOT EXISTS "Fall_Risk"           TEXT,
  ADD COLUMN IF NOT EXISTS "Allergy_Alert"       TEXT,
  ADD COLUMN IF NOT EXISTS "Medication_Given"    TEXT,
  ADD COLUMN IF NOT EXISTS "Procedure_Done"      TEXT;

-- Vital Signs — add Consciousness (AVPU / GCS / alert) for ward observations.
ALTER TABLE public."HIS_One_IPD_Vital_Signs"
  ADD COLUMN IF NOT EXISTS "Consciousness" TEXT;
