-- Add explicit leave categories and replace the UI's replacement-staff requirement
-- with a free-text note while keeping legacy replacement audit data readable.

ALTER TABLE public."HIS_One_Manpower_Assignments"
  ADD COLUMN IF NOT EXISTS "Leave_Type" TEXT;

UPDATE public."HIS_One_Manpower_Assignments"
SET "Leave_Type" = 'vacation'
WHERE "Status" = 'leave' AND "Leave_Type" IS NULL;

ALTER TABLE public."HIS_One_Manpower_Assignments"
  DROP CONSTRAINT IF EXISTS "HIS_One_Manpower_Assignments_replacement_check";

ALTER TABLE public."HIS_One_Manpower_Assignments"
  DROP CONSTRAINT IF EXISTS "HIS_One_Manpower_Assignments_leave_type_check";

ALTER TABLE public."HIS_One_Manpower_Assignments"
  ADD CONSTRAINT "HIS_One_Manpower_Assignments_leave_type_check"
  CHECK (
    ("Status" = 'leave' AND "Leave_Type" IN ('vacation', 'sick', 'personal'))
    OR
    ("Status" <> 'leave' AND "Leave_Type" IS NULL)
  );

ALTER TABLE public."HIS_One_Manpower_History"
  ADD COLUMN IF NOT EXISTS "Leave_Type_Before" TEXT,
  ADD COLUMN IF NOT EXISTS "Leave_Type_After" TEXT,
  ADD COLUMN IF NOT EXISTS "Note_Before" TEXT,
  ADD COLUMN IF NOT EXISTS "Note_After" TEXT;

CREATE OR REPLACE FUNCTION public.his_one_audit_manpower_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_name TEXT;
  actor_id UUID;
  actor_name TEXT;
  staff_name TEXT;
  staff_type TEXT;
  replacement_before_name TEXT;
  replacement_after_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_name := 'created';
    actor_id := NEW."Created_By";
  ELSIF OLD."Deleted_At" IS NULL AND NEW."Deleted_At" IS NOT NULL THEN
    action_name := 'deleted';
    actor_id := NEW."Deleted_By";
  ELSIF OLD."Status" IS NOT DISTINCT FROM NEW."Status"
    AND OLD."Leave_Type" IS NOT DISTINCT FROM NEW."Leave_Type"
    AND OLD."Replacement_Staff_ID" IS NOT DISTINCT FROM NEW."Replacement_Staff_ID"
    AND OLD."Note" IS NOT DISTINCT FROM NEW."Note" THEN
    RETURN NEW;
  ELSIF OLD."Replacement_Staff_ID" IS DISTINCT FROM NEW."Replacement_Staff_ID"
    AND NEW."Replacement_Staff_ID" IS NOT NULL THEN
    action_name := 'replaced';
    actor_id := NEW."Updated_By";
  ELSE
    action_name := 'updated';
    actor_id := NEW."Updated_By";
  END IF;

  SELECT s."Full_Name", lower(btrim(s."Employee_Type"))
    INTO staff_name, staff_type
  FROM public."HIS_One_Staff_Profiles" AS s
  WHERE s."ID" = NEW."Staff_ID";

  SELECT s."Full_Name" INTO replacement_before_name
  FROM public."HIS_One_Staff_Profiles" AS s
  WHERE s."ID" = CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."Replacement_Staff_ID" END;

  SELECT s."Full_Name" INTO replacement_after_name
  FROM public."HIS_One_Staff_Profiles" AS s
  WHERE s."ID" = NEW."Replacement_Staff_ID";

  SELECT u."Name" INTO actor_name
  FROM public."HIS_One_Users" AS u
  WHERE u."Auth_User_ID" = actor_id
  LIMIT 1;

  INSERT INTO public."HIS_One_Manpower_History" (
    "Assignment_ID", "Action", "Duty_Date", "Shift", "Staff_ID", "Staff_Name", "Staff_Type",
    "Status_Before", "Status_After", "Leave_Type_Before", "Leave_Type_After", "Note_Before", "Note_After",
    "Replacement_Before_ID", "Replacement_Before_Name", "Replacement_After_ID", "Replacement_After_Name",
    "Changed_By", "Changed_By_Name"
  ) VALUES (
    NEW."ID", action_name, NEW."Duty_Date", NEW."Shift", NEW."Staff_ID",
    COALESCE(staff_name, NEW."Staff_ID"::text), COALESCE(staff_type, 'unknown'),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."Status" END,
    CASE WHEN action_name = 'deleted' THEN NULL ELSE NEW."Status" END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."Leave_Type" END,
    CASE WHEN action_name = 'deleted' THEN NULL ELSE NEW."Leave_Type" END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."Note" END,
    CASE WHEN action_name = 'deleted' THEN NULL ELSE NEW."Note" END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."Replacement_Staff_ID" END,
    replacement_before_name,
    CASE WHEN action_name = 'deleted' THEN NULL ELSE NEW."Replacement_Staff_ID" END,
    CASE WHEN action_name = 'deleted' THEN NULL ELSE replacement_after_name END,
    actor_id,
    COALESCE(NULLIF(btrim(actor_name), ''), actor_id::text, 'System')
  );

  RETURN NEW;
END
$$;
