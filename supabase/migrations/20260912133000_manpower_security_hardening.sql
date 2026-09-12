-- Lock server-controlled audit fields and keep soft-deleted assignments immutable.

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

  IF TG_OP = 'INSERT' THEN
    NEW."Created_By" := auth.uid();
    NEW."Updated_By" := auth.uid();
    NEW."Created_At" := now();
    NEW."Updated_At" := now();
    NEW."Deleted_At" := NULL;
    NEW."Deleted_By" := NULL;
  ELSE
    IF OLD."Deleted_At" IS NOT NULL THEN
      RAISE EXCEPTION 'Deleted manpower assignments are immutable';
    END IF;

    IF NEW."Duty_Date" IS DISTINCT FROM OLD."Duty_Date"
      OR NEW."Shift" IS DISTINCT FROM OLD."Shift"
      OR NEW."Staff_ID" IS DISTINCT FROM OLD."Staff_ID" THEN
      RAISE EXCEPTION 'Assignment date, shift and staff cannot be changed; create a new assignment instead';
    END IF;

    NEW."Created_By" := OLD."Created_By";
    NEW."Created_At" := OLD."Created_At";
    NEW."Updated_By" := auth.uid();
    NEW."Updated_At" := now();
    IF NEW."Deleted_At" IS NOT NULL THEN
      NEW."Deleted_At" := now();
      NEW."Deleted_By" := auth.uid();
      RETURN NEW;
    END IF;
    NEW."Deleted_By" := NULL;
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

DROP POLICY IF EXISTS his_manpower_assignments_read ON public."HIS_One_Manpower_Assignments";
CREATE POLICY his_manpower_assignments_read ON public."HIS_One_Manpower_Assignments"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user() AND "Deleted_At" IS NULL);

REVOKE ALL ON FUNCTION public.his_one_validate_manpower_assignment() FROM PUBLIC, anon;

