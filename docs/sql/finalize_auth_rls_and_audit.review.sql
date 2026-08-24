-- REVIEWED MANUAL CUTOVER — DO NOT add this file to automatic migrations.
--
-- Purpose:
--   1. Remove the temporary anonymous compatibility bridge.
--   2. Keep staff profile/password fields away from the browser.
--   3. Make OPD encounter revisions append-only.
--
-- Preconditions:
--   * The Supabase Auth frontend and Cloudflare Functions are deployed.
--   * Admin, Doctor and Nurse UAT has passed with authenticated sessions.
--   * 20260809110000_auth_rls_cutover.sql has been applied.
--   * A database backup has completed and a maintenance window is active.
--
-- This file is deliberately stored under docs/sql so `supabase db push` cannot
-- apply it accidentally while the legacy production bundle is still running.

BEGIN;

DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (tablename LIKE 'HIS_One_%' OR tablename IN ('opd_observations', 'opd_observation_notes'))
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.schemaname, table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS his_legacy_anon_all ON %I.%I', table_record.schemaname, table_record.tablename);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', table_record.schemaname, table_record.tablename);
  END LOOP;
END
$$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- The browser may read only non-secret staff profile fields.
REVOKE ALL ON TABLE public."HIS_One_Users" FROM authenticated;
GRANT SELECT (
  "ID", "Auth_User_ID", "Name", "Email", "Role", "Permissions",
  "ButtonPermissions", "Status", "Must_Change_Password", "Last_Login_At", "Updated_At"
) ON public."HIS_One_Users" TO authenticated;
GRANT UPDATE ("Must_Change_Password", "Last_Login_At")
  ON public."HIS_One_Users" TO authenticated;

-- Encounter revisions are clinical audit records: readable and append-only.
DO $$
DECLARE
  policy_record record;
BEGIN
  IF to_regclass('public."HIS_One_OPD_Encounter_Revisions"') IS NOT NULL THEN
    ALTER TABLE public."HIS_One_OPD_Encounter_Revisions" ENABLE ROW LEVEL SECURITY;

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'HIS_One_OPD_Encounter_Revisions'
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public."HIS_One_OPD_Encounter_Revisions"',
        policy_record.policyname
      );
    END LOOP;

    REVOKE ALL ON TABLE public."HIS_One_OPD_Encounter_Revisions" FROM anon, authenticated;
    GRANT SELECT, INSERT ON TABLE public."HIS_One_OPD_Encounter_Revisions" TO authenticated;

    CREATE POLICY his_revision_read_active
      ON public."HIS_One_OPD_Encounter_Revisions"
      FOR SELECT TO authenticated
      USING (public.his_one_is_active_user());

    CREATE POLICY his_revision_append_clinical
      ON public."HIS_One_OPD_Encounter_Revisions"
      FOR INSERT TO authenticated
      WITH CHECK (
        public.his_one_is_admin()
        OR (
          public.his_one_current_role() = 'doctor'
          AND public.his_one_has_action('opd', 'edit')
        )
      );
  END IF;
END
$$;

COMMIT;

-- Required post-cutover checks (run with the anon key from a clean session):
--   HIS_One_Users SELECT                       -> HTTP 401/403
--   HIS_One_Users SELECT Password_Hash         -> HTTP 401/403
--   HIS_One_Patients INSERT/UPDATE/DELETE       -> HTTP 401/403
--   Authenticated Doctor revision INSERT        -> succeeds
--   Authenticated Doctor revision UPDATE/DELETE -> HTTP 401/403
