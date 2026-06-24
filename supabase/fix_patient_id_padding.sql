-- Step 1 of 2 — Rename short Patient_IDs (e.g. LXH2026-009) to 6-digit padded format.
-- Wrapped in a DO block so Supabase SQL Editor runs it as ONE statement and
-- the temp table survives across the UPDATEs.
--
-- Strategy: each short ID is reassigned to (max_in_year + N), guaranteeing no
-- collision with existing 6-digit padded IDs.

DO $$
BEGIN
  -- Build the mapping (old_id -> new_id) once and reuse for every child table.
  CREATE TEMP TABLE _patient_id_remap ON COMMIT DROP AS
  WITH short_ids AS (
    SELECT
      "Patient_ID" AS old_id,
      substring("Patient_ID" FROM '^LXH(\d{4})') AS year_part,
      (regexp_match("Patient_ID", '^LXH\d{4}-(\d+)$'))[1]::int AS short_num
    FROM public."HIS_One_Patients"
    WHERE "Patient_ID" ~ '^LXH\d{4}-\d{1,5}$'
  ),
  year_max AS (
    SELECT
      substring("Patient_ID" FROM '^LXH(\d{4})') AS year_part,
      COALESCE(MAX((regexp_match("Patient_ID", '^LXH\d{4}-(\d+)$'))[1]::int), 0) AS max_num
    FROM public."HIS_One_Patients"
    WHERE "Patient_ID" ~ '^LXH\d{4}-\d{6,}$'
    GROUP BY substring("Patient_ID" FROM '^LXH(\d{4})')
  ),
  ranked AS (
    SELECT
      s.old_id,
      s.year_part,
      s.short_num,
      COALESCE(ym.max_num, 0) AS max_num,
      row_number() OVER (PARTITION BY s.year_part ORDER BY s.short_num) AS rn
    FROM short_ids s
    LEFT JOIN year_max ym ON ym.year_part = s.year_part
  )
  SELECT
    old_id,
    'LXH' || year_part || '-' || lpad((max_num + rn)::text, 6, '0') AS new_id
  FROM ranked;

  RAISE NOTICE 'Remap built: % rows', (SELECT COUNT(*) FROM _patient_id_remap);

  -- 1. Update child tables FIRST so their Patient_ID still points at a real parent.
  UPDATE public."HIS_One_Visits" v
     SET "Patient_ID" = m.new_id
    FROM _patient_id_remap m
   WHERE v."Patient_ID" = m.old_id;

  UPDATE public."HIS_One_Appointments" a
     SET "Patient_ID" = m.new_id
    FROM _patient_id_remap m
   WHERE a."Patient_ID" = m.old_id;

  UPDATE public."HIS_One_Patient_Vaccines" pv
     SET "Patient_ID" = m.new_id
    FROM _patient_id_remap m
   WHERE pv."Patient_ID" = m.old_id;

  UPDATE public."HIS_One_Admissions" ad
     SET "Patient_ID" = m.new_id
    FROM _patient_id_remap m
   WHERE ad."Patient_ID" = m.old_id;

  UPDATE public."HIS_One_Organizations" o
     SET "Patient_ID" = m.new_id
    FROM _patient_id_remap m
   WHERE o."Patient_ID" = m.old_id;

  -- 2. Finally update the parent table (the primary key itself).
  UPDATE public."HIS_One_Patients" p
     SET "Patient_ID" = m.new_id
    FROM _patient_id_remap m
   WHERE p."Patient_ID" = m.old_id;

  RAISE NOTICE 'Done.';
END $$;

-- Sanity check — run separately, should return 0.
SELECT COUNT(*) AS short_ids_remaining
  FROM public."HIS_One_Patients"
 WHERE "Patient_ID" ~ '^LXH\d{4}-\d{1,5}$';
