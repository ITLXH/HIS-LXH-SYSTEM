-- Preserve existing access rules; evaluate auth.uid() once per statement.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $repair$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'realtime'
 AND tablename=E'messages' AND policyname=E'his_staff_presence_read'
 AND cmd=E'SELECT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'((realtime.topic() = ''his:staff:presence''::text) AND (extension = ''presence''::text) AND (EXISTS ( SELECT 1\n   FROM "HIS_One_Users"\n  WHERE (("HIS_One_Users"."Auth_User_ID" = auth.uid()) AND ("HIS_One_Users"."Status" = ''active''::text)))))'
 AND with_check IS NOT DISTINCT FROM NULL) THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: his_staff_presence_read'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'realtime'
 AND tablename=E'messages' AND policyname=E'his_staff_presence_write'
 AND cmd=E'INSERT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM NULL
 AND with_check IS NOT DISTINCT FROM E'((realtime.topic() = ''his:staff:presence''::text) AND (extension = ''presence''::text) AND (EXISTS ( SELECT 1\n   FROM "HIS_One_Users"\n  WHERE (("HIS_One_Users"."Auth_User_ID" = auth.uid()) AND ("HIS_One_Users"."Status" = ''active''::text)))))') THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: his_staff_presence_write'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'public'
 AND tablename=E'HIS_One_Users' AND policyname=E'his_user_self_session_update'
 AND cmd=E'UPDATE' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'("Auth_User_ID" = auth.uid())'
 AND with_check IS NOT DISTINCT FROM E'("Auth_User_ID" = auth.uid())') THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: his_user_self_session_update'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'public'
 AND tablename=E'UXI_One_main_staff' AND policyname=E'uxi_staff_read'
 AND cmd=E'SELECT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'((id = auth.uid()) OR (uxi_staff_role() = ''Admin''::text))'
 AND with_check IS NOT DISTINCT FROM NULL) THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: uxi_staff_read'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'pmc'
 AND tablename=E'pmc_user_profiles' AND policyname=E'user_profiles_read_v1'
 AND cmd=E'SELECT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'((user_id = auth.uid()) OR pmc_actor_has_permission_v1(''users.read''::text))'
 AND with_check IS NOT DISTINCT FROM NULL) THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: user_profiles_read_v1'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'pmc'
 AND tablename=E'pmc_user_roles' AND policyname=E'user_roles_read_v1'
 AND cmd=E'SELECT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'((user_id = auth.uid()) OR pmc_actor_has_permission_v1(''users.read''::text))'
 AND with_check IS NOT DISTINCT FROM NULL) THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: user_roles_read_v1'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'pmc'
 AND tablename=E'pmc_user_departments' AND policyname=E'user_departments_read_v1'
 AND cmd=E'SELECT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'((user_id = auth.uid()) OR pmc_actor_has_permission_v1(''users.read''::text))'
 AND with_check IS NOT DISTINCT FROM NULL) THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: user_departments_read_v1'; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=E'pmc'
 AND tablename=E'pmc_user_warehouses' AND policyname=E'user_warehouses_read_v1'
 AND cmd=E'SELECT' AND roles=ARRAY['authenticated']::name[] AND permissive='PERMISSIVE'
 AND qual IS NOT DISTINCT FROM E'((user_id = auth.uid()) OR pmc_actor_has_permission_v1(''users.read''::text))'
 AND with_check IS NOT DISTINCT FROM NULL) THEN
 RAISE EXCEPTION 'RLS_POLICY_DRIFT: user_warehouses_read_v1'; END IF;
END $repair$;
ALTER POLICY "his_staff_presence_read" ON "realtime"."messages"
USING (((realtime.topic() = 'his:staff:presence'::text) AND (extension = 'presence'::text) AND (EXISTS ( SELECT 1
   FROM "HIS_One_Users"
  WHERE (("HIS_One_Users"."Auth_User_ID" = (SELECT auth.uid())) AND ("HIS_One_Users"."Status" = 'active'::text))))));
ALTER POLICY "his_staff_presence_write" ON "realtime"."messages"
WITH CHECK (((realtime.topic() = 'his:staff:presence'::text) AND (extension = 'presence'::text) AND (EXISTS ( SELECT 1
   FROM "HIS_One_Users"
  WHERE (("HIS_One_Users"."Auth_User_ID" = (SELECT auth.uid())) AND ("HIS_One_Users"."Status" = 'active'::text))))));
ALTER POLICY "his_user_self_session_update" ON "public"."HIS_One_Users"
USING (("Auth_User_ID" = (SELECT auth.uid())))
WITH CHECK (("Auth_User_ID" = (SELECT auth.uid())));
ALTER POLICY "uxi_staff_read" ON "public"."UXI_One_main_staff"
USING (((id = (SELECT auth.uid())) OR (uxi_staff_role() = 'Admin'::text)));
ALTER POLICY "user_profiles_read_v1" ON "pmc"."pmc_user_profiles"
USING (((user_id = (SELECT auth.uid())) OR pmc_actor_has_permission_v1('users.read'::text)));
ALTER POLICY "user_roles_read_v1" ON "pmc"."pmc_user_roles"
USING (((user_id = (SELECT auth.uid())) OR pmc_actor_has_permission_v1('users.read'::text)));
ALTER POLICY "user_departments_read_v1" ON "pmc"."pmc_user_departments"
USING (((user_id = (SELECT auth.uid())) OR pmc_actor_has_permission_v1('users.read'::text)));
ALTER POLICY "user_warehouses_read_v1" ON "pmc"."pmc_user_warehouses"
USING (((user_id = (SELECT auth.uid())) OR pmc_actor_has_permission_v1('users.read'::text)));
NOTIFY pgrst, 'reload schema';
COMMIT;
