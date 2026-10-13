-- REVIEW ONLY: integration authentication / role UAT must be verified first.
-- Never run against production before HIS/LIS/UXI compatibility tests and rollback review.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF current_setting('his.legacy_access_cutover_verified',true) IS DISTINCT FROM 'yes' THEN
   RAISE EXCEPTION 'HIS/LIS/UXI authenticated integration UAT gate has not been verified';
 END IF;
END $$;
ALTER TABLE public."HIS_One_Patients" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS his_legacy_anon_all ON public."HIS_One_Patients";
REVOKE SELECT,INSERT,UPDATE,DELETE ON public."HIS_One_Patients" FROM anon;
NOTIFY pgrst,'reload schema';
COMMIT;
-- No clinical data is deleted. Roll back application releases while retaining records.
-- Do not blindly reintroduce anonymous access to roll back; review authenticated integration failures.
