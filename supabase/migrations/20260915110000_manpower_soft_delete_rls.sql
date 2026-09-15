-- UPDATE operations also require SELECT visibility for the resulting row.
-- Keep deleted assignments hidden from regular users while allowing active
-- admins to complete and audit soft deletes.

DROP POLICY IF EXISTS his_manpower_assignments_admin_read_all
  ON public."HIS_One_Manpower_Assignments";

CREATE POLICY his_manpower_assignments_admin_read_all
  ON public."HIS_One_Manpower_Assignments"
  FOR SELECT TO authenticated
  USING (
    public.his_one_is_active_user()
    AND public.his_one_is_admin()
  );
