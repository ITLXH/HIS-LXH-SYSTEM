-- Supabase Auth profile foundation.
-- This migration is intentionally additive so the existing deployed frontend
-- keeps working while staff accounts are linked to auth.users.

ALTER TABLE public."HIS_One_Users"
  ADD COLUMN IF NOT EXISTS "Auth_User_ID" uuid,
  ADD COLUMN IF NOT EXISTS "Must_Change_Password" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "Last_Login_At" timestamptz,
  ADD COLUMN IF NOT EXISTS "Updated_At" timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_Users_Auth_User_ID"
  ON public."HIS_One_Users" ("Auth_User_ID")
  WHERE "Auth_User_ID" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_Users_Email_lower"
  ON public."HIS_One_Users" (lower("Email"));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'HIS_One_Users_Auth_User_ID_fkey'
      AND conrelid = 'public."HIS_One_Users"'::regclass
  ) THEN
    ALTER TABLE public."HIS_One_Users"
      ADD CONSTRAINT "HIS_One_Users_Auth_User_ID_fkey"
      FOREIGN KEY ("Auth_User_ID") REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.his_one_current_profile()
RETURNS public."HIS_One_Users"
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u
  FROM public."HIS_One_Users" AS u
  WHERE u."Auth_User_ID" = auth.uid()
    AND u."Status" = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.his_one_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(COALESCE((public.his_one_current_profile())."Role", ''))
$$;

CREATE OR REPLACE FUNCTION public.his_one_is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.his_one_current_profile() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.his_one_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.his_one_current_role() = 'admin'
$$;

REVOKE ALL ON FUNCTION public.his_one_current_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.his_one_current_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.his_one_is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.his_one_is_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.his_one_current_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.his_one_touch_user_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."Updated_At" = now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "trg_HIS_One_Users_updated_at" ON public."HIS_One_Users";
CREATE TRIGGER "trg_HIS_One_Users_updated_at"
BEFORE UPDATE ON public."HIS_One_Users"
FOR EACH ROW EXECUTE FUNCTION public.his_one_touch_user_updated_at();
