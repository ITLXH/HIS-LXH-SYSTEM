-- Production persistence, audit trail, realtime and access control for Daily Manpower.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."HIS_One_Manpower_Assignments" (
  "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Duty_Date" DATE NOT NULL,
  "Shift" TEXT NOT NULL,
  "Staff_ID" UUID NOT NULL REFERENCES public."HIS_One_Staff_Profiles"("ID") ON DELETE RESTRICT,
  "Status" TEXT NOT NULL DEFAULT 'working',
  "Replacement_Staff_ID" UUID NULL REFERENCES public."HIS_One_Staff_Profiles"("ID") ON DELETE RESTRICT,
  "Note" TEXT,
  "Created_By" UUID NOT NULL DEFAULT auth.uid(),
  "Updated_By" UUID NOT NULL DEFAULT auth.uid(),
  "Created_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Updated_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Deleted_At" TIMESTAMPTZ,
  "Deleted_By" UUID,
  CONSTRAINT "HIS_One_Manpower_Assignments_shift_check"
    CHECK ("Shift" IN ('morning', 'evening', 'night')),
  CONSTRAINT "HIS_One_Manpower_Assignments_status_check"
    CHECK ("Status" IN ('working', 'leave', 'absent', 'swapped')),
  CONSTRAINT "HIS_One_Manpower_Assignments_replacement_check"
    CHECK (
      ("Status" = 'working' AND "Replacement_Staff_ID" IS NULL)
      OR
      ("Status" <> 'working' AND "Replacement_Staff_ID" IS NOT NULL)
    ),
  CONSTRAINT "HIS_One_Manpower_Assignments_different_replacement_check"
    CHECK ("Replacement_Staff_ID" IS NULL OR "Replacement_Staff_ID" <> "Staff_ID")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_HIS_One_Manpower_active_staff_shift"
  ON public."HIS_One_Manpower_Assignments" ("Duty_Date", "Shift", "Staff_ID")
  WHERE "Deleted_At" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_HIS_One_Manpower_date_shift"
  ON public."HIS_One_Manpower_Assignments" ("Duty_Date" DESC, "Shift")
  WHERE "Deleted_At" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_HIS_One_Manpower_replacement"
  ON public."HIS_One_Manpower_Assignments" ("Duty_Date", "Shift", "Replacement_Staff_ID")
  WHERE "Deleted_At" IS NULL AND "Replacement_Staff_ID" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."HIS_One_Manpower_History" (
  "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Assignment_ID" UUID NOT NULL,
  "Action" TEXT NOT NULL,
  "Duty_Date" DATE NOT NULL,
  "Shift" TEXT NOT NULL,
  "Staff_ID" UUID NOT NULL,
  "Staff_Name" TEXT NOT NULL,
  "Staff_Type" TEXT NOT NULL,
  "Status_Before" TEXT,
  "Status_After" TEXT,
  "Replacement_Before_ID" UUID,
  "Replacement_Before_Name" TEXT,
  "Replacement_After_ID" UUID,
  "Replacement_After_Name" TEXT,
  "Changed_By" UUID,
  "Changed_By_Name" TEXT NOT NULL,
  "Changed_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "HIS_One_Manpower_History_action_check"
    CHECK ("Action" IN ('created', 'updated', 'replaced', 'deleted'))
);

CREATE INDEX IF NOT EXISTS "idx_HIS_One_Manpower_History_lookup"
  ON public."HIS_One_Manpower_History" ("Duty_Date" DESC, "Shift", "Staff_Type", "Changed_At" DESC);
CREATE INDEX IF NOT EXISTS "idx_HIS_One_Manpower_History_assignment"
  ON public."HIS_One_Manpower_History" ("Assignment_ID", "Changed_At" DESC);

CREATE OR REPLACE FUNCTION public.his_one_validate_manpower_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_type TEXT;
  replacement_type TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW."Duty_Date"::text || ':' || NEW."Shift", 0)
  );

  NEW."Updated_By" = auth.uid();
  NEW."Updated_At" = now();
  IF NEW."Deleted_At" IS NOT NULL THEN
    NEW."Deleted_By" = COALESCE(NEW."Deleted_By", auth.uid());
    RETURN NEW;
  END IF;

  SELECT lower(btrim(s."Employee_Type"))
    INTO staff_type
  FROM public."HIS_One_Staff_Profiles" AS s
  WHERE s."ID" = NEW."Staff_ID" AND s."Status" = 'active';

  IF staff_type IS NULL OR staff_type NOT IN ('doctor', 'nurse', 'pharmacy', 'lab', 'radiology') THEN
    RAISE EXCEPTION 'Selected staff profile is inactive or is not a supported manpower department';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."HIS_One_Manpower_Assignments" AS a
    WHERE a."Duty_Date" = NEW."Duty_Date"
      AND a."Shift" = NEW."Shift"
      AND a."Deleted_At" IS NULL
      AND a."ID" <> NEW."ID"
      AND (a."Staff_ID" = NEW."Staff_ID" OR a."Replacement_Staff_ID" = NEW."Staff_ID")
  ) THEN
    RAISE EXCEPTION 'Staff member is already assigned to this date and shift';
  END IF;

  IF NEW."Replacement_Staff_ID" IS NOT NULL THEN
    SELECT lower(btrim(s."Employee_Type"))
      INTO replacement_type
    FROM public."HIS_One_Staff_Profiles" AS s
    WHERE s."ID" = NEW."Replacement_Staff_ID" AND s."Status" = 'active';

    IF replacement_type IS NULL OR replacement_type <> staff_type THEN
      RAISE EXCEPTION 'Replacement must be active and in the same department';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public."HIS_One_Manpower_Assignments" AS a
      WHERE a."Duty_Date" = NEW."Duty_Date"
        AND a."Shift" = NEW."Shift"
        AND a."Deleted_At" IS NULL
        AND a."ID" <> NEW."ID"
        AND (a."Staff_ID" = NEW."Replacement_Staff_ID" OR a."Replacement_Staff_ID" = NEW."Replacement_Staff_ID")
    ) THEN
      RAISE EXCEPTION 'Replacement staff is already assigned to this date and shift';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "trg_HIS_One_Manpower_validate" ON public."HIS_One_Manpower_Assignments";
CREATE TRIGGER "trg_HIS_One_Manpower_validate"
BEFORE INSERT OR UPDATE ON public."HIS_One_Manpower_Assignments"
FOR EACH ROW EXECUTE FUNCTION public.his_one_validate_manpower_assignment();

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
    "Status_Before", "Status_After", "Replacement_Before_ID", "Replacement_Before_Name",
    "Replacement_After_ID", "Replacement_After_Name", "Changed_By", "Changed_By_Name"
  ) VALUES (
    NEW."ID", action_name, NEW."Duty_Date", NEW."Shift", NEW."Staff_ID",
    COALESCE(staff_name, NEW."Staff_ID"::text), COALESCE(staff_type, 'unknown'),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."Status" END,
    CASE WHEN action_name = 'deleted' THEN NULL ELSE NEW."Status" END,
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

DROP TRIGGER IF EXISTS "trg_HIS_One_Manpower_audit" ON public."HIS_One_Manpower_Assignments";
CREATE TRIGGER "trg_HIS_One_Manpower_audit"
AFTER INSERT OR UPDATE ON public."HIS_One_Manpower_Assignments"
FOR EACH ROW EXECUTE FUNCTION public.his_one_audit_manpower_assignment();

ALTER TABLE public."HIS_One_Manpower_Assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Manpower_History" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS his_manpower_assignments_read ON public."HIS_One_Manpower_Assignments";
CREATE POLICY his_manpower_assignments_read ON public."HIS_One_Manpower_Assignments"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user());

DROP POLICY IF EXISTS his_manpower_assignments_admin_insert ON public."HIS_One_Manpower_Assignments";
CREATE POLICY his_manpower_assignments_admin_insert ON public."HIS_One_Manpower_Assignments"
  FOR INSERT TO authenticated
  WITH CHECK (public.his_one_is_admin());

DROP POLICY IF EXISTS his_manpower_assignments_admin_update ON public."HIS_One_Manpower_Assignments";
CREATE POLICY his_manpower_assignments_admin_update ON public."HIS_One_Manpower_Assignments"
  FOR UPDATE TO authenticated
  USING (public.his_one_is_admin())
  WITH CHECK (public.his_one_is_admin());

DROP POLICY IF EXISTS his_manpower_history_read ON public."HIS_One_Manpower_History";
CREATE POLICY his_manpower_history_read ON public."HIS_One_Manpower_History"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user());

REVOKE ALL ON TABLE public."HIS_One_Manpower_Assignments" FROM anon;
REVOKE ALL ON TABLE public."HIS_One_Manpower_History" FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public."HIS_One_Manpower_History" FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public."HIS_One_Manpower_Assignments" TO authenticated;
GRANT SELECT ON TABLE public."HIS_One_Manpower_History" TO authenticated;

REVOKE ALL ON FUNCTION public.his_one_validate_manpower_assignment() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_audit_manpower_assignment() FROM PUBLIC, anon;

ALTER TABLE public."HIS_One_Manpower_Assignments" REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."HIS_One_Manpower_Assignments";
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."HIS_One_Manpower_History";
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
