-- Keep activity history for 30 days and attach deleted row snapshots so an
-- administrator can restore accidental deletions from the Activity Log.

ALTER TABLE public."HIS_One_activity_logs"
  ADD COLUMN IF NOT EXISTS "deleted_table" TEXT,
  ADD COLUMN IF NOT EXISTS "deleted_record" JSONB,
  ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "idx_HIS_One_activity_logs_retention"
  ON public."HIS_One_activity_logs" ("timestamp");
CREATE INDEX IF NOT EXISTS "idx_HIS_One_activity_logs_recovery"
  ON public."HIS_One_activity_logs" ("timestamp" DESC)
  WHERE "action" = 'Delete' AND "deleted_record" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.his_one_delete_to_activity_log(
  p_table_name TEXT,
  p_filters JSONB,
  p_module TEXT,
  p_details TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_tables CONSTANT TEXT[] := ARRAY[
    'HIS_One_Patients', 'HIS_One_Visits', 'HIS_One_Appointments',
    'HIS_One_Vaccines_Master', 'HIS_One_Patient_Vaccines',
    'HIS_One_Drugs_Master', 'HIS_One_Labs_Master', 'HIS_One_MasterData',
    'HIS_One_Locations', 'HIS_One_Service_Lists', 'HIS_One_Organizations', 'HIS_One_Wards',
    'HIS_One_Rooms', 'HIS_One_Beds', 'HIS_One_IPD_Visits',
    'HIS_One_IPD_Doctor_Notes', 'HIS_One_IPD_Nursing_Notes',
    'HIS_One_IPD_Vital_Signs', 'HIS_One_IPD_Medication_Orders',
    'HIS_One_IPD_Radiology_Orders', 'HIS_One_IPD_Procedures',
    'HIS_One_IPD_Billing_Items', 'HIS_One_IPD_Discharge_Summaries',
    'HIS_One_Staff_Profiles'
  ];
  filter_item RECORD;
  filter_sql TEXT := '';
  value_text TEXT;
  quoted_values TEXT;
  predicate TEXT;
  candidate RECORD;
  primary_key_column TEXT;
  actor_id TEXT;
  actor_name TEXT;
  deleted_count INTEGER := 0;
BEGIN
  IF NOT public.his_one_is_admin() THEN
    RAISE EXCEPTION 'Only administrators can delete records with recovery';
  END IF;
  IF p_table_name IS NULL OR NOT (p_table_name = ANY (allowed_tables)) THEN
    RAISE EXCEPTION 'Table is not enabled for recoverable deletion';
  END IF;
  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'object' OR p_filters = '{}'::jsonb THEN
    RAISE EXCEPTION 'At least one deletion filter is required';
  END IF;
  IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE EXCEPTION 'Deletion table does not exist';
  END IF;

  SELECT "ID"::TEXT, "Name"
    INTO actor_id, actor_name
    FROM public."HIS_One_Users"
    WHERE "Auth_User_ID" = auth.uid()
    LIMIT 1;
  actor_id := COALESCE(actor_id, auth.uid()::TEXT, '-');
  actor_name := COALESCE(actor_name, 'Admin');

  SELECT attribute.attname INTO primary_key_column
    FROM pg_index AS index_info
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = index_info.indrelid
     AND attribute.attnum = ANY(index_info.indkey)
    WHERE index_info.indrelid = to_regclass(format('public.%I', p_table_name))
      AND index_info.indisprimary
    ORDER BY attribute.attnum
    LIMIT 1;

  FOR filter_item IN SELECT key, value FROM jsonb_each(p_filters)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = to_regclass(format('public.%I', p_table_name))
        AND attname = filter_item.key AND attnum > 0 AND NOT attisdropped
    ) THEN
      RAISE EXCEPTION 'Unknown deletion filter column: %', filter_item.key;
    END IF;

    IF filter_sql <> '' THEN filter_sql := filter_sql || ' AND '; END IF;
    IF filter_item.value = 'null'::jsonb THEN
      predicate := format('%I IS NULL', filter_item.key);
    ELSIF jsonb_typeof(filter_item.value) = 'array' THEN
      SELECT string_agg(quote_literal(value), ',')
        INTO quoted_values
        FROM jsonb_array_elements_text(filter_item.value) AS filter_values(value);
      IF quoted_values IS NULL THEN
        RAISE EXCEPTION 'Deletion filter arrays cannot be empty';
      END IF;
      predicate := format('%I::TEXT IN (%s)', filter_item.key, quoted_values);
    ELSE
      value_text := filter_item.value #>> '{}';
      predicate := format('%I::TEXT = %L', filter_item.key, value_text);
    END IF;
    filter_sql := filter_sql || predicate;
  END LOOP;

  FOR candidate IN EXECUTE format(
    'SELECT ctid AS row_ctid, to_jsonb(row_value) AS row_snapshot FROM public.%I AS row_value WHERE %s FOR UPDATE',
    p_table_name,
    filter_sql
  )
  LOOP
    INSERT INTO public."HIS_One_activity_logs" (
      "timestamp", "user_id", "user_name", "action", "details", "module",
      "deleted_table", "deleted_record"
    ) VALUES (
      now(), actor_id, actor_name, 'Delete',
      COALESCE(p_details, '') || CASE
        WHEN primary_key_column IS NULL THEN ''
        ELSE format(' (%s: %s)', primary_key_column, candidate.row_snapshot ->> primary_key_column)
      END,
      COALESCE(p_module, ''), p_table_name, candidate.row_snapshot
    );
    EXECUTE format('DELETE FROM public.%I WHERE ctid = $1', p_table_name)
      USING candidate.row_ctid;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.his_one_restore_activity_log(p_log_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_row public."HIS_One_activity_logs"%ROWTYPE;
  allowed_tables CONSTANT TEXT[] := ARRAY[
    'HIS_One_Patients', 'HIS_One_Visits', 'HIS_One_Appointments',
    'HIS_One_Vaccines_Master', 'HIS_One_Patient_Vaccines',
    'HIS_One_Drugs_Master', 'HIS_One_Labs_Master', 'HIS_One_MasterData',
    'HIS_One_Locations', 'HIS_One_Service_Lists', 'HIS_One_Organizations', 'HIS_One_Wards',
    'HIS_One_Rooms', 'HIS_One_Beds', 'HIS_One_IPD_Visits',
    'HIS_One_IPD_Doctor_Notes', 'HIS_One_IPD_Nursing_Notes',
    'HIS_One_IPD_Vital_Signs', 'HIS_One_IPD_Medication_Orders',
    'HIS_One_IPD_Radiology_Orders', 'HIS_One_IPD_Procedures',
    'HIS_One_IPD_Billing_Items', 'HIS_One_IPD_Discharge_Summaries',
    'HIS_One_Staff_Profiles'
  ];
  actor_id TEXT;
  actor_name TEXT;
BEGIN
  IF NOT public.his_one_is_admin() THEN
    RAISE EXCEPTION 'Only administrators can restore deleted records';
  END IF;

  SELECT * INTO log_row
    FROM public."HIS_One_activity_logs"
    WHERE "id" = p_log_id
    FOR UPDATE;
  IF NOT FOUND OR log_row."action" <> 'Delete' OR log_row."deleted_record" IS NULL THEN
    RAISE EXCEPTION 'This activity entry has no recoverable record';
  END IF;
  IF log_row."restored_at" IS NOT NULL THEN
    RAISE EXCEPTION 'This record has already been returned';
  END IF;
  IF log_row."timestamp" IS NULL OR log_row."timestamp" < now() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'The 30-day recovery period has expired';
  END IF;
  IF log_row."deleted_table" IS NULL OR NOT (log_row."deleted_table" = ANY (allowed_tables)) THEN
    RAISE EXCEPTION 'This record type cannot be restored';
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
    log_row."deleted_table", log_row."deleted_table"
  ) USING log_row."deleted_record";

  SELECT "ID"::TEXT, "Name"
    INTO actor_id, actor_name
    FROM public."HIS_One_Users"
    WHERE "Auth_User_ID" = auth.uid()
    LIMIT 1;
  actor_id := COALESCE(actor_id, auth.uid()::TEXT, '-');
  actor_name := COALESCE(actor_name, 'Admin');

  UPDATE public."HIS_One_activity_logs"
    SET "restored_at" = now(), "deleted_record" = NULL
    WHERE "id" = p_log_id;

  INSERT INTO public."HIS_One_activity_logs" (
    "timestamp", "user_id", "user_name", "action", "details", "module"
  ) VALUES (
    now(), actor_id, actor_name, 'Return',
    format('Returned deleted record from activity log #%s', p_log_id),
    COALESCE(log_row."module", '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.his_one_purge_expired_activity_logs()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged_count BIGINT;
BEGIN
  DELETE FROM public."HIS_One_activity_logs"
    WHERE "timestamp" IS NULL OR "timestamp" < now() - INTERVAL '30 days';
  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.his_one_activity_log_retention_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.his_one_purge_expired_activity_logs();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_HIS_One_activity_logs_retention"
  ON public."HIS_One_activity_logs";
CREATE TRIGGER "trg_HIS_One_activity_logs_retention"
  AFTER INSERT ON public."HIS_One_activity_logs"
  FOR EACH ROW EXECUTE FUNCTION public.his_one_activity_log_retention_trigger();

REVOKE ALL ON FUNCTION public.his_one_delete_to_activity_log(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_restore_activity_log(BIGINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_purge_expired_activity_logs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.his_one_activity_log_retention_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.his_one_delete_to_activity_log(TEXT, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.his_one_restore_activity_log(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.his_one_purge_expired_activity_logs() TO service_role;

-- Supabase projects with pg_cron installed clean old activity rows daily.
DO $$
DECLARE
  existing_job BIGINT;
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    SELECT jobid INTO existing_job
      FROM cron.job
      WHERE jobname = 'his-one-activity-log-retention'
      LIMIT 1;
    IF existing_job IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job);
    END IF;
    PERFORM cron.schedule(
      'his-one-activity-log-retention',
      '17 3 * * *',
      'SELECT public.his_one_purge_expired_activity_logs();'
    );
  END IF;
END;
$$;
