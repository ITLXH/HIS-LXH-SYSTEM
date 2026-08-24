-- Composite rows containing nullable columns do not reliably satisfy
-- `row IS NOT NULL`; use an explicit EXISTS check for active staff sessions.
CREATE OR REPLACE FUNCTION public.his_one_is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."HIS_One_Users" AS u
    WHERE u."Auth_User_ID" = auth.uid()
      AND u."Status" = 'active'
  )
$$;

REVOKE ALL ON FUNCTION public.his_one_is_active_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.his_one_is_active_user() TO authenticated, service_role;
