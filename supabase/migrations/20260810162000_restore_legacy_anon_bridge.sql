-- TEMPORARY COMPATIBILITY BRIDGE
--
-- The currently deployed Cloudflare Pages bundle still authenticates against
-- HIS_One_Users and performs all data operations with the Supabase anon role.
-- Keep it operational while the Supabase Auth frontend is being validated and
-- deployed. Remove this bridge after the deployed bundle uses Auth sessions.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (tablename LIKE 'HIS_One_%' OR tablename IN ('opd_observations', 'opd_observation_notes'))
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO anon', t.schemaname, t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS his_legacy_anon_all ON %I.%I', t.schemaname, t.tablename);
    EXECUTE format(
      'CREATE POLICY his_legacy_anon_all ON %I.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t.schemaname, t.tablename
    );
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

COMMENT ON POLICY his_legacy_anon_all ON public."HIS_One_Users" IS
  'Temporary bridge for the legacy Pages bundle; remove after the Auth frontend is deployed.';
