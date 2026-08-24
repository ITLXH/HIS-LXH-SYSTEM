-- Temporary bridge for the Supabase Auth rollout. Anonymous policies remain
-- until the explicit RLS cutover migration is applied after deployment/UAT.
ALTER TABLE public."HIS_One_Users" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ("ID", "Auth_User_ID", "Name", "Email", "Role", "Permissions", "ButtonPermissions", "Status", "Must_Change_Password", "Last_Login_At", "Updated_At")
  ON public."HIS_One_Users" TO authenticated;
GRANT UPDATE ("Must_Change_Password", "Last_Login_At")
  ON public."HIS_One_Users" TO authenticated;

DROP POLICY IF EXISTS his_auth_transition_profile_read ON public."HIS_One_Users";
CREATE POLICY his_auth_transition_profile_read ON public."HIS_One_Users"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user());

DROP POLICY IF EXISTS his_auth_transition_self_update ON public."HIS_One_Users";
CREATE POLICY his_auth_transition_self_update ON public."HIS_One_Users"
  FOR UPDATE TO authenticated
  USING ("Auth_User_ID" = auth.uid())
  WITH CHECK ("Auth_User_ID" = auth.uid());
