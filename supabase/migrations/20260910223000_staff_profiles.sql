-- Staff directory foundation for the Daily Manpower module.
-- The local preview uses browser storage; applying this migration is reserved
-- for the later shared/production rollout.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."HIS_One_Staff_Profiles" (
  "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "User_ID" BIGINT NULL REFERENCES public."HIS_One_Users"("ID") ON DELETE SET NULL,
  "Employee_Code" TEXT NOT NULL UNIQUE,
  "Full_Name" TEXT NOT NULL,
  "Employee_Type" TEXT NOT NULL DEFAULT 'other',
  "Department" TEXT NOT NULL,
  "Position" TEXT,
  "Specialty" TEXT,
  "Phone" TEXT,
  "Email" TEXT,
  "Photo_Path" TEXT,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "Created_By" UUID DEFAULT auth.uid(),
  "Created_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Updated_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "HIS_One_Staff_Profiles_employee_type_check"
    CHECK ("Employee_Type" IN ('doctor','nurse','lab','radiology','pharmacy','reception','other')),
  CONSTRAINT "HIS_One_Staff_Profiles_status_check"
    CHECK ("Status" IN ('active','on_leave','inactive')),
  CONSTRAINT "HIS_One_Staff_Profiles_employee_code_not_blank"
    CHECK (length(btrim("Employee_Code")) > 0),
  CONSTRAINT "HIS_One_Staff_Profiles_full_name_not_blank"
    CHECK (length(btrim("Full_Name")) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_Staff_Profiles_employee_code_lower"
  ON public."HIS_One_Staff_Profiles" (lower("Employee_Code"));
CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_Staff_Profiles_user_id"
  ON public."HIS_One_Staff_Profiles" ("User_ID") WHERE "User_ID" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_HIS_One_Staff_Profiles_directory"
  ON public."HIS_One_Staff_Profiles" ("Status", "Employee_Type", "Department", "Full_Name");

-- Bootstrap the shared directory from the two legacy sources already used by
-- the HIS. User profiles win because they can preserve the account link;
-- MasterData fills in doctors/nurses who do not have a login account.
INSERT INTO public."HIS_One_Staff_Profiles" (
  "User_ID", "Employee_Code", "Full_Name", "Employee_Type", "Department", "Position", "Status"
)
SELECT DISTINCT ON (lower(btrim(u."Name")))
  u."ID",
  CASE WHEN lower(btrim(u."Role")) = 'doctor' THEN 'DOC-U-' ELSE 'NUR-U-' END || u."ID"::text,
  btrim(u."Name"),
  lower(btrim(u."Role")),
  CASE WHEN lower(btrim(u."Role")) = 'doctor' THEN 'ແພດ' ELSE 'ພະຍາບານ' END,
  CASE WHEN lower(btrim(u."Role")) = 'doctor' THEN 'ແພດ' ELSE 'ພະຍາບານ' END,
  CASE WHEN lower(COALESCE(u."Status", 'active')) = 'active' THEN 'active' ELSE 'inactive' END
FROM public."HIS_One_Users" AS u
WHERE lower(btrim(COALESCE(u."Role", ''))) IN ('doctor', 'nurse')
  AND btrim(COALESCE(u."Name", '')) <> ''
ORDER BY lower(btrim(u."Name")), u."ID"
ON CONFLICT ("Employee_Code") DO NOTHING;

INSERT INTO public."HIS_One_Staff_Profiles" (
  "Employee_Code", "Full_Name", "Employee_Type", "Department", "Position", "Status"
)
SELECT
  CASE WHEN m."Category" = 'Doctor' THEN 'DOC-M-' ELSE 'NUR-M-' END || m."ID"::text,
  btrim(m."Value"),
  CASE WHEN m."Category" = 'Doctor' THEN 'doctor' ELSE 'nurse' END,
  CASE WHEN m."Category" = 'Doctor' THEN 'ແພດ' ELSE 'ພະຍາບານ' END,
  CASE WHEN m."Category" = 'Doctor' THEN 'ແພດ' ELSE 'ພະຍາບານ' END,
  'active'
FROM public."HIS_One_MasterData" AS m
WHERE m."Category" IN ('Doctor', 'Nurse')
  AND btrim(COALESCE(m."Value", '')) <> ''
  AND lower(btrim(m."Value")) <> 'opd doctor'
  AND NOT EXISTS (
    SELECT 1
    FROM public."HIS_One_Staff_Profiles" AS s
    WHERE lower(btrim(s."Full_Name")) = lower(btrim(m."Value"))
  )
ON CONFLICT ("Employee_Code") DO NOTHING;

DROP TRIGGER IF EXISTS "trg_HIS_One_Staff_Profiles_updated_at" ON public."HIS_One_Staff_Profiles";
CREATE TRIGGER "trg_HIS_One_Staff_Profiles_updated_at"
BEFORE UPDATE ON public."HIS_One_Staff_Profiles"
FOR EACH ROW EXECUTE FUNCTION public.his_one_touch_user_updated_at();

ALTER TABLE public."HIS_One_Staff_Profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS his_staff_profiles_read ON public."HIS_One_Staff_Profiles";
CREATE POLICY his_staff_profiles_read ON public."HIS_One_Staff_Profiles"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user());

DROP POLICY IF EXISTS his_staff_profiles_admin_insert ON public."HIS_One_Staff_Profiles";
CREATE POLICY his_staff_profiles_admin_insert ON public."HIS_One_Staff_Profiles"
  FOR INSERT TO authenticated
  WITH CHECK (public.his_one_is_admin());

DROP POLICY IF EXISTS his_staff_profiles_admin_update ON public."HIS_One_Staff_Profiles";
CREATE POLICY his_staff_profiles_admin_update ON public."HIS_One_Staff_Profiles"
  FOR UPDATE TO authenticated
  USING (public.his_one_is_admin())
  WITH CHECK (public.his_one_is_admin());

DROP POLICY IF EXISTS his_staff_profiles_admin_delete ON public."HIS_One_Staff_Profiles";
CREATE POLICY his_staff_profiles_admin_delete ON public."HIS_One_Staff_Profiles"
  FOR DELETE TO authenticated
  USING (public.his_one_is_admin());

REVOKE ALL ON TABLE public."HIS_One_Staff_Profiles" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."HIS_One_Staff_Profiles" TO authenticated;

-- Private avatar bucket: every active HIS user may view staff photos; only an
-- administrator may create, replace, or remove them.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'his-staff-avatars',
  'his-staff-avatars',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS his_staff_avatar_read ON storage.objects;
CREATE POLICY his_staff_avatar_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'his-staff-avatars' AND public.his_one_is_active_user());

DROP POLICY IF EXISTS his_staff_avatar_admin_insert ON storage.objects;
CREATE POLICY his_staff_avatar_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'his-staff-avatars' AND public.his_one_is_admin());

DROP POLICY IF EXISTS his_staff_avatar_admin_update ON storage.objects;
CREATE POLICY his_staff_avatar_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'his-staff-avatars' AND public.his_one_is_admin())
  WITH CHECK (bucket_id = 'his-staff-avatars' AND public.his_one_is_admin());

DROP POLICY IF EXISTS his_staff_avatar_admin_delete ON storage.objects;
CREATE POLICY his_staff_avatar_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'his-staff-avatars' AND public.his_one_is_admin());
