-- Local package only: requires separately scoped HIS migration and activation approval.
BEGIN;
SET LOCAL lock_timeout='3s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='HIS_One_Visits' AND c.relrowsecurity) THEN RAISE EXCEPTION 'SOURCE_RLS_REQUIRED'; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS pmc;
CREATE TABLE pmc.his_native_submission_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO pmc.his_native_submission_settings VALUES(true,false);
ALTER TABLE pmc.his_native_submission_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pmc.his_native_submission_settings FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA pmc TO authenticated;
GRANT SELECT ON pmc.his_native_submission_settings TO authenticated;
CREATE POLICY native_submission_setting_read ON pmc.his_native_submission_settings FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL AND public.his_one_is_active_user());
CREATE FUNCTION public.pmc_submit_native_batch_v1(p_patient_id text,p_visit_id text,p_expected_revision integer,p_batch_id text,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pmc AS $$
DECLARE source record; existing jsonb; target jsonb; sent jsonb; line jsonb; stamp text; next_revision integer; drug text; affected integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL OR public.his_one_is_active_user() IS NOT TRUE
 OR coalesce(public.his_one_current_role(),'') NOT IN ('admin','doctor') OR public.his_one_has_action('opd','edit') IS NOT TRUE THEN
  RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pmc.his_native_submission_settings WHERE singleton AND enabled) THEN RAISE EXCEPTION 'SUBMISSION_DISABLED'; END IF;
 IF p_patient_id IS NULL OR p_patient_id !~ '^[A-Za-z0-9_-]{1,120}$' OR p_visit_id IS NULL OR p_visit_id !~ '^[A-Za-z0-9_-]{1,120}$'
 OR p_batch_id IS NULL OR p_batch_id !~ '^[A-Za-z0-9._:-]{1,120}$' OR p_expected_revision IS NULL OR p_expected_revision<0
 OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
 IF jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF jsonb_typeof(line) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(line) k WHERE k NOT IN ('prescriptionItemId','sourceDrugId','name','quantity','dose','route','frequency','duration','instructions','prescribedAt'))
  OR coalesce(line->>'prescriptionItemId','') !~ '^[A-Za-z0-9._:-]{1,120}$'
  OR coalesce(line->>'sourceDrugId','') !~ '^[A-Za-z0-9._:-]{1,120}$'
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['name','route','frequency','duration','instructions']) k WHERE jsonb_typeof(line->k) IS DISTINCT FROM 'string' OR length(btrim(line->>k)) NOT BETWEEN 1 AND 1000)
  OR coalesce(line->>'quantity','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
  OR coalesce(line->>'dose','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
  SELECT "Drug_Name" INTO drug FROM public."HIS_One_Drugs_Master" WHERE "Drug_ID"=line->>'sourceDrugId';
  IF NOT FOUND OR drug IS DISTINCT FROM line->>'name' THEN RAISE EXCEPTION 'CATALOG_REQUIRED'; END IF;
  IF (line->>'quantity')::numeric<=0 OR (line->>'dose')::numeric<=0 THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'prescriptionItemId') FROM jsonb_array_elements(p_lines))<>jsonb_array_length(p_lines) THEN RAISE EXCEPTION 'DUPLICATE_LINE'; END IF;
 -- Invoker mode retains the source table's existing SELECT/UPDATE RLS and privileges.
 IF (SELECT count(*) FROM public."HIS_One_Visits" WHERE "Patient_ID"=p_patient_id AND "Visit_ID"=p_visit_id)<>1 THEN RAISE EXCEPTION 'VISIT_NOT_FOUND'; END IF;
 SELECT "Prescription_JSON","EMR_Revision" INTO source FROM public."HIS_One_Visits" WHERE "Patient_ID"=p_patient_id AND "Visit_ID"=p_visit_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'VISIT_NOT_FOUND'; END IF;
 BEGIN existing:=coalesce(nullif(source."Prescription_JSON",''),'[]')::jsonb; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'SOURCE_INVALID'; END;
 IF jsonb_typeof(existing) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SOURCE_INVALID'; END IF;
 SELECT coalesce(jsonb_agg(value - ARRAY['pharmacyStatus','status','prescriptionBatchId','sentAt'] ORDER BY value->>'prescriptionItemId'),'[]') INTO target FROM jsonb_array_elements(existing) WHERE value->>'prescriptionBatchId'=p_batch_id;
 IF jsonb_array_length(target)>0 THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(existing) WHERE value->>'prescriptionBatchId'=p_batch_id AND coalesce(value->>'pharmacyStatus',value->>'status','') NOT IN ('sent_to_pharmacy','accepted','preparing','ready','dispensed')) THEN RAISE EXCEPTION 'SOURCE_DRAFT_REVIEW_REQUIRED'; END IF;
  IF target IS DISTINCT FROM (SELECT jsonb_agg(value ORDER BY value->>'prescriptionItemId') FROM jsonb_array_elements(p_lines)) THEN RAISE EXCEPTION 'SENT_BATCH_CHANGED'; END IF;
  RETURN jsonb_build_object('revision',source."EMR_Revision",'batchId',p_batch_id,'replayed',true);
 END IF;
 IF coalesce(source."EMR_Revision",0)<>p_expected_revision OR p_expected_revision=2147483647 THEN RAISE EXCEPTION 'ENCOUNTER_CHANGED' USING ERRCODE='40001'; END IF;
 IF jsonb_array_length(existing)+jsonb_array_length(p_lines)>100 THEN RAISE EXCEPTION 'INVALID_BATCH'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(existing) a JOIN jsonb_array_elements(p_lines) b ON a.value->>'prescriptionItemId'=b.value->>'prescriptionItemId') THEN RAISE EXCEPTION 'DUPLICATE_LINE'; END IF;
 stamp:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 SELECT jsonb_agg(value||jsonb_build_object('prescriptionBatchId',p_batch_id,'status','sent_to_pharmacy','pharmacyStatus','sent_to_pharmacy','sentAt',stamp)) INTO sent FROM jsonb_array_elements(p_lines);
 next_revision:=p_expected_revision+1;
 UPDATE public."HIS_One_Visits" SET "Prescription_JSON"=(existing||sent)::text,"EMR_Revision"=next_revision WHERE "Patient_ID"=p_patient_id AND "Visit_ID"=p_visit_id AND "EMR_Revision"=p_expected_revision;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'ENCOUNTER_CHANGED' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('revision',next_revision,'batchId',p_batch_id,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.pmc_submit_native_batch_v1(text,text,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pmc_submit_native_batch_v1(text,text,integer,text,jsonb) TO authenticated;
COMMIT;
