-- Local preparation only. No remote application/activation without scoped authorization.
BEGIN;
SET LOCAL lock_timeout='3s';
CREATE TABLE pmc.his_pmc_catalogue_settings(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false,
 version text,generated_at timestamptz,synced_at timestamptz);
INSERT INTO pmc.his_pmc_catalogue_settings(singleton) VALUES(true);
CREATE TABLE pmc.his_pmc_medicines(
 id uuid PRIMARY KEY,code text NOT NULL,name_lo text NOT NULL,name_en text NOT NULL,
 unit_id uuid NOT NULL,unit_code text NOT NULL,unit_name_lo text NOT NULL,unit_name_en text NOT NULL,
 is_active boolean NOT NULL DEFAULT true);
ALTER TABLE pmc.his_pmc_catalogue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmc.his_pmc_medicines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pmc.his_pmc_catalogue_settings,pmc.his_pmc_medicines FROM PUBLIC,anon,authenticated;
-- Submission remains invoker/RLS checked; these two read policies expose only the medication catalogue.
GRANT SELECT ON pmc.his_pmc_catalogue_settings,pmc.his_pmc_medicines TO authenticated;
CREATE POLICY catalogue_settings_staff ON pmc.his_pmc_catalogue_settings FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL AND public.his_one_is_active_user() AND public.his_one_current_role() IN ('admin','doctor') AND public.his_one_has_action('opd','edit'));
CREATE POLICY catalogue_medicines_staff ON pmc.his_pmc_medicines FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL AND public.his_one_is_active_user() AND public.his_one_current_role() IN ('admin','doctor') AND public.his_one_has_action('opd','edit'));
CREATE FUNCTION public.pmc_apply_medicine_catalogue_v1(p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pmc AS $$
DECLARE items jsonb; entry jsonb; settings record; generated timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' OR p_snapshot->>'contractVersion' IS DISTINCT FROM '1'
 OR jsonb_typeof(p_snapshot->'items') IS DISTINCT FROM 'array' OR length(p_snapshot::text)>8000000 THEN RAISE EXCEPTION 'INVALID_CATALOGUE'; END IF;
 items:=p_snapshot->'items';
 IF jsonb_array_length(items)>10000 OR p_snapshot->>'version' IS DISTINCT FROM md5(items::text) THEN RAISE EXCEPTION 'INVALID_CATALOGUE'; END IF;
 BEGIN generated:=(p_snapshot->>'generatedAt')::timestamptz; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_CATALOGUE'; END;
 IF generated IS NULL OR generated>now()+interval '1 minute' THEN RAISE EXCEPTION 'INVALID_CATALOGUE'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR jsonb_typeof(entry->'unit') IS DISTINCT FROM 'object'
  OR coalesce(entry->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR coalesce(entry->'unit'->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['code','nameLo','nameEn']) k WHERE jsonb_typeof(entry->k) IS DISTINCT FROM 'string' OR length(btrim(entry->>k)) NOT BETWEEN 1 AND 160)
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['code','nameLo','nameEn']) k WHERE jsonb_typeof(entry->'unit'->k) IS DISTINCT FROM 'string' OR length(btrim(entry->'unit'->>k)) NOT BETWEEN 1 AND 160)
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry) k WHERE k NOT IN ('id','code','nameLo','nameEn','unit'))
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(entry->'unit') k WHERE k NOT IN ('id','code','nameLo','nameEn')) THEN RAISE EXCEPTION 'INVALID_CATALOGUE'; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(items))<>jsonb_array_length(items)
 OR (SELECT count(DISTINCT value->>'code') FROM jsonb_array_elements(items))<>jsonb_array_length(items) THEN RAISE EXCEPTION 'INVALID_CATALOGUE'; END IF;
 SELECT * INTO settings FROM pmc.his_pmc_catalogue_settings WHERE singleton FOR UPDATE;
 IF generated<settings.generated_at OR (generated=settings.generated_at AND settings.version IS DISTINCT FROM p_snapshot->>'version') THEN RAISE EXCEPTION 'STALE_CATALOGUE'; END IF;
 IF settings.version=p_snapshot->>'version' THEN
  UPDATE pmc.his_pmc_catalogue_settings SET generated_at=generated,synced_at=clock_timestamp() WHERE singleton;
  RETURN jsonb_build_object('version',settings.version,'count',jsonb_array_length(items));
 END IF;
 UPDATE pmc.his_pmc_medicines SET is_active=false;
 INSERT INTO pmc.his_pmc_medicines(id,code,name_lo,name_en,unit_id,unit_code,unit_name_lo,unit_name_en,is_active)
 SELECT (value->>'id')::uuid,value->>'code',value->>'nameLo',value->>'nameEn',(value->'unit'->>'id')::uuid,value->'unit'->>'code',value->'unit'->>'nameLo',value->'unit'->>'nameEn',true FROM jsonb_array_elements(items)
 ON CONFLICT(id) DO UPDATE SET code=excluded.code,name_lo=excluded.name_lo,name_en=excluded.name_en,unit_id=excluded.unit_id,unit_code=excluded.unit_code,unit_name_lo=excluded.unit_name_lo,unit_name_en=excluded.unit_name_en,is_active=true;
 UPDATE pmc.his_pmc_catalogue_settings SET version=p_snapshot->>'version',generated_at=generated,synced_at=clock_timestamp() WHERE singleton;
 RETURN jsonb_build_object('version',p_snapshot->>'version','count',jsonb_array_length(items));
END $$;
REVOKE ALL ON FUNCTION public.pmc_apply_medicine_catalogue_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pmc_apply_medicine_catalogue_v1(jsonb) TO service_role;
CREATE FUNCTION public.pmc_orderable_medicines_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pmc AS $$
DECLARE settings record; items jsonb;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL OR public.his_one_is_active_user() IS NOT TRUE OR coalesce(public.his_one_current_role(),'') NOT IN ('admin','doctor') OR public.his_one_has_action('opd','edit') IS NOT TRUE THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO settings FROM pmc.his_pmc_catalogue_settings WHERE singleton;
 IF settings.enabled IS NOT TRUE THEN RAISE EXCEPTION 'CATALOGUE_DISABLED'; END IF;
 IF settings.synced_at IS NULL OR settings.synced_at<now()-interval '2 minutes' THEN RAISE EXCEPTION 'CATALOGUE_STALE'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name_lo,'nameEn',name_en,'desc',unit_name_lo,'unitId',unit_id,'unitCode',unit_code,'source','pmc') ORDER BY name_lo,id),'[]') INTO items FROM pmc.his_pmc_medicines WHERE is_active;
 RETURN jsonb_build_object('version',settings.version,'items',items);
END $$;
REVOKE ALL ON FUNCTION public.pmc_orderable_medicines_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pmc_orderable_medicines_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.pmc_submit_native_batch_v1(p_patient_id text,p_visit_id text,p_expected_revision integer,p_batch_id text,p_lines jsonb)
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
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(line) k WHERE k NOT IN ('prescriptionItemId','sourceDrugId','name','quantity','dose','route','frequency','duration','instructions','prescribedAt','catalogueVersion'))
  OR coalesce(line->>'prescriptionItemId','') !~ '^[A-Za-z0-9._:-]{1,120}$'
  OR coalesce(line->>'sourceDrugId','') !~ '^[A-Za-z0-9._:-]{1,120}$'
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['name','route','frequency','duration','instructions']) k WHERE jsonb_typeof(line->k) IS DISTINCT FROM 'string' OR length(btrim(line->>k)) NOT BETWEEN 1 AND 1000)
  OR coalesce(line->>'quantity','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
  OR coalesce(line->>'dose','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' THEN RAISE EXCEPTION 'INVALID_LINE'; END IF;
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
 -- Replays above preserve signed historical batches after retirement or rename.
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF EXISTS(SELECT 1 FROM pmc.his_pmc_catalogue_settings WHERE singleton AND enabled) THEN
   IF NOT EXISTS(SELECT 1 FROM pmc.his_pmc_catalogue_settings WHERE singleton AND synced_at>=now()-interval '2 minutes') THEN RAISE EXCEPTION 'CATALOGUE_STALE'; END IF;
   IF NOT EXISTS(SELECT 1 FROM pmc.his_pmc_catalogue_settings WHERE singleton AND version=line->>'catalogueVersion') THEN RAISE EXCEPTION 'CATALOGUE_CHANGED'; END IF;
   SELECT name_lo INTO drug FROM pmc.his_pmc_medicines WHERE id::text=line->>'sourceDrugId' AND is_active;
  ELSE
   SELECT "Drug_Name" INTO drug FROM public."HIS_One_Drugs_Master" WHERE "Drug_ID"=line->>'sourceDrugId';
  END IF;
  IF NOT FOUND OR drug IS DISTINCT FROM line->>'name' THEN RAISE EXCEPTION 'CATALOG_REQUIRED'; END IF;
 END LOOP;
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
COMMIT;
