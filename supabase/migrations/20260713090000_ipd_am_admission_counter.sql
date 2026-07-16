-- Database-backed AM allocator for IPD admissions.
-- AM is the admission number, while HN/Patient_ID remains the OPD patient code.

CREATE TABLE IF NOT EXISTS public."HIS_One_AM_Counters" (
  "Admission_Date" TEXT PRIMARY KEY,
  "Last_Seq" INTEGER NOT NULL DEFAULT 0,
  "Updated_At" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public."HIS_One_AM_Counters" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_AM_Counters" ON public."HIS_One_AM_Counters";
CREATE POLICY "anon_all_AM_Counters"
  ON public."HIS_One_AM_Counters"
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_AM_Counters" ON public."HIS_One_AM_Counters";
CREATE POLICY "authenticated_all_AM_Counters"
  ON public."HIS_One_AM_Counters"
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.his_one_generate_am_id(p_admission_date TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date TEXT;
  v_prefix TEXT;
  v_existing_max INTEGER := 0;
  v_next_seq INTEGER := 0;
BEGIN
  v_date := COALESCE(NULLIF(trim(p_admission_date), ''), to_char((now() AT TIME ZONE 'Asia/Vientiane')::date, 'YYYY-MM-DD'));

  IF v_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_date := to_char(v_date::date, 'YYYY-MM-DD');
  END IF;

  v_prefix := 'AM' || replace(v_date, '-', '');

  SELECT GREATEST(
    COALESCE(MAX(
      CASE
        WHEN "Admission_ID" ~ ('^' || v_prefix || '-[0-9]+$')
        THEN substring("Admission_ID" from ('^' || v_prefix || '-([0-9]+)$'))::INTEGER
        ELSE NULL
      END
    ), 0),
    COUNT(*) FILTER (WHERE "Admission_Date" = v_date)::INTEGER
  )
  INTO v_existing_max
  FROM public."HIS_One_Admissions"
  WHERE "Admission_Date" = v_date
     OR "Admission_ID" LIKE (v_prefix || '-%');

  INSERT INTO public."HIS_One_AM_Counters" AS c ("Admission_Date", "Last_Seq", "Updated_At")
  VALUES (v_date, v_existing_max + 1, now())
  ON CONFLICT ("Admission_Date") DO UPDATE
    SET "Last_Seq" = GREATEST(c."Last_Seq", v_existing_max) + 1,
        "Updated_At" = now()
  RETURNING "Last_Seq" INTO v_next_seq;

  RETURN v_prefix || '-' || lpad(v_next_seq::TEXT, 3, '0');
END;
$$;

GRANT ALL ON TABLE public."HIS_One_AM_Counters" TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.his_one_generate_am_id(TEXT) TO anon, authenticated;
