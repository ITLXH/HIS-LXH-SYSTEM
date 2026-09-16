CREATE TABLE IF NOT EXISTS public."HIS_One_Manpower_Shift_Overviews" (
  "ID" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Duty_Date" DATE NOT NULL,
  "Shift" TEXT NOT NULL CHECK ("Shift" IN ('morning', 'evening', 'night')),
  "Overview" TEXT NOT NULL DEFAULT '',
  "Created_By" UUID NOT NULL DEFAULT auth.uid(),
  "Updated_By" UUID NOT NULL DEFAULT auth.uid(),
  "Created_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "Updated_At" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "HIS_One_Manpower_Shift_Overviews_date_shift_key" UNIQUE ("Duty_Date", "Shift"),
  CONSTRAINT "HIS_One_Manpower_Shift_Overviews_length_check" CHECK (char_length("Overview") <= 4000)
);

CREATE OR REPLACE FUNCTION public.his_one_touch_manpower_shift_overview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."Created_By" := auth.uid();
    NEW."Created_At" := now();
  ELSE
    NEW."Created_By" := OLD."Created_By";
    NEW."Created_At" := OLD."Created_At";
  END IF;

  NEW."Updated_By" := auth.uid();
  NEW."Updated_At" := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.his_one_touch_manpower_shift_overview() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS his_one_touch_manpower_shift_overview
  ON public."HIS_One_Manpower_Shift_Overviews";
CREATE TRIGGER his_one_touch_manpower_shift_overview
BEFORE INSERT OR UPDATE ON public."HIS_One_Manpower_Shift_Overviews"
FOR EACH ROW EXECUTE FUNCTION public.his_one_touch_manpower_shift_overview();

ALTER TABLE public."HIS_One_Manpower_Shift_Overviews" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS his_manpower_shift_overviews_read
  ON public."HIS_One_Manpower_Shift_Overviews";
CREATE POLICY his_manpower_shift_overviews_read
  ON public."HIS_One_Manpower_Shift_Overviews"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user());

DROP POLICY IF EXISTS his_manpower_shift_overviews_insert
  ON public."HIS_One_Manpower_Shift_Overviews";
CREATE POLICY his_manpower_shift_overviews_insert
  ON public."HIS_One_Manpower_Shift_Overviews"
  FOR INSERT TO authenticated
  WITH CHECK (public.his_one_is_active_user() AND public.his_one_is_admin());

DROP POLICY IF EXISTS his_manpower_shift_overviews_update
  ON public."HIS_One_Manpower_Shift_Overviews";
CREATE POLICY his_manpower_shift_overviews_update
  ON public."HIS_One_Manpower_Shift_Overviews"
  FOR UPDATE TO authenticated
  USING (public.his_one_is_active_user() AND public.his_one_is_admin())
  WITH CHECK (public.his_one_is_active_user() AND public.his_one_is_admin());

REVOKE ALL ON TABLE public."HIS_One_Manpower_Shift_Overviews" FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public."HIS_One_Manpower_Shift_Overviews" TO authenticated;

ALTER TABLE public."HIS_One_Manpower_Shift_Overviews" REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime
    ADD TABLE public."HIS_One_Manpower_Shift_Overviews";
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
