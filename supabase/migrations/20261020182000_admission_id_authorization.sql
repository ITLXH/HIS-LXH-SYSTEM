-- Require the same active-user/action checks as admission INSERT before allocating an ID.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $repair$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc
   WHERE oid=to_regprocedure('public.his_one_generate_am_id(text)')
     AND prosecdef AND md5(prosrc)='63f40834c49f090f0b7193e41cbaea93') THEN
   RAISE EXCEPTION 'ADMISSION_ID_FUNCTION_DRIFT';
 END IF;
END $repair$;
CREATE OR REPLACE FUNCTION public.his_one_generate_am_id(p_admission_date text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_date TEXT;
  v_prefix TEXT;
  v_existing_max INTEGER := 0;
  v_next_seq INTEGER := 0;
BEGIN
  IF NOT COALESCE(public.his_one_is_active_user(), false)
     OR NOT COALESCE(public.his_one_can_table_write('HIS_One_Admissions', 'insert'), false) THEN
    RAISE EXCEPTION 'Active admission permission required' USING ERRCODE = '42501';
  END IF;
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
$function$;
COMMIT;
