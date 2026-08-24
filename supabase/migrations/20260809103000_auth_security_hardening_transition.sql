-- Close direct RPC access to the composite profile helper. Policy helpers
-- expose only a role string or boolean and are not executable by anon.
REVOKE ALL ON FUNCTION public.his_one_current_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.his_one_current_profile() TO service_role;

REVOKE ALL ON FUNCTION public.his_one_current_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.his_one_current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_is_admin() TO authenticated, service_role;

ALTER FUNCTION public.his_one_touch_user_updated_at() SET search_path = public;

-- Transitional RLS for the two newly-added OPD tables. The anon policies keep
-- the legacy deployed frontend working until the final RLS cutover removes all
-- anonymous access.
ALTER TABLE public."HIS_One_OPD_Encounter_Revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Result_Acknowledgments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS his_transition_anon_all ON public."HIS_One_OPD_Encounter_Revisions";
CREATE POLICY his_transition_anon_all ON public."HIS_One_OPD_Encounter_Revisions"
  FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS his_transition_staff_all ON public."HIS_One_OPD_Encounter_Revisions";
CREATE POLICY his_transition_staff_all ON public."HIS_One_OPD_Encounter_Revisions"
  FOR ALL TO authenticated
  USING (public.his_one_is_active_user())
  WITH CHECK (public.his_one_is_active_user());

DROP POLICY IF EXISTS his_transition_anon_all ON public."HIS_One_Result_Acknowledgments";
CREATE POLICY his_transition_anon_all ON public."HIS_One_Result_Acknowledgments"
  FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS his_transition_staff_all ON public."HIS_One_Result_Acknowledgments";
CREATE POLICY his_transition_staff_all ON public."HIS_One_Result_Acknowledgments"
  FOR ALL TO authenticated
  USING (public.his_one_is_active_user())
  WITH CHECK (public.his_one_is_active_user());
