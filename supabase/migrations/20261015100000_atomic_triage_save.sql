-- STAGING FIRST. Requires scoped OPD vitals schema and existing HIS auth helpers.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
CREATE TABLE public.his_one_triage_save_receipts (
 request_id text PRIMARY KEY,
 user_id uuid NOT NULL DEFAULT auth.uid(),
 payload jsonb NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.his_one_triage_save_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.his_one_triage_save_receipts FROM PUBLIC,anon,authenticated;
-- Receipts are private: clients cannot forge a successful save.
GRANT ALL ON public.his_one_triage_save_receipts TO service_role;
CREATE POLICY triage_receipt_read ON public.his_one_triage_save_receipts FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY triage_receipt_insert ON public.his_one_triage_save_receipts FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.his_one_save_triage_atomic(p_request_id text,p_expected_visit jsonb,p_vital jsonb,p_visit jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_visit public."HIS_One_Visits"%rowtype;
 v_next public."HIS_One_Visits"%rowtype;
 v_vital public."HIS_One_OPD_Vital_Signs"%rowtype;
 v_receipt public.his_one_triage_save_receipts%rowtype;
 v_payload jsonb;v_response jsonb;v_key text;v_set text:='';v_count int;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.his_one_is_active_user(),false)
 OR NOT COALESCE(public.his_one_can_table_write('HIS_One_OPD_Vital_Signs','insert'),false)
 OR NOT COALESCE(public.his_one_can_table_write('HIS_One_Visits','update'),false) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='TRIAGE_SAVE_DENIED';END IF;
 IF p_request_id IS NULL OR p_request_id !~ '^[A-Za-z0-9_-]{1,100}$'
 OR jsonb_typeof(p_expected_visit) IS DISTINCT FROM 'object'
 OR jsonb_typeof(p_vital) IS DISTINCT FROM 'object' OR jsonb_typeof(p_visit) IS DISTINCT FROM 'object'
 OR p_vital->>'Vital_ID' IS DISTINCT FROM p_request_id
 OR NULLIF(p_vital->>'Visit_ID','') IS NULL OR NULLIF(p_vital->>'Patient_ID','') IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_TRIAGE_REQUEST';END IF;
 v_payload=jsonb_build_object('vital',p_vital,'visit',p_visit,'expected',p_expected_visit);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id,0));
 SELECT * INTO v_receipt FROM public.his_one_triage_save_receipts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF v_receipt.user_id IS DISTINCT FROM auth.uid() OR v_receipt.payload IS DISTINCT FROM v_payload THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='REQUEST_REUSE_MISMATCH';END IF;
  RETURN v_receipt.response;
 END IF;
 SELECT * INTO v_visit FROM public."HIS_One_Visits" WHERE "Visit_ID"=p_vital->>'Visit_ID'
 AND "Patient_ID"=p_vital->>'Patient_ID' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='VISIT_NOT_AVAILABLE';END IF;
 IF to_jsonb(v_visit) IS DISTINCT FROM p_expected_visit THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='VISIT_CHANGED_REOPEN';END IF;
 FOR v_key IN SELECT jsonb_object_keys(p_vital) LOOP
  IF v_key NOT IN ('Vital_ID','Visit_ID','Patient_ID','Recorded_At','Temperature','BP_Systolic','BP_Diastolic','Pulse','Respiration','SpO2','Weight','Height','BMI','Symptoms','Notes','Recorded_By','Created_At','Updated_At') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_VITAL_FIELD';END IF;
 END LOOP;
 FOR v_key IN SELECT jsonb_object_keys(p_visit) LOOP
  IF v_key NOT IN ('Status','Date','BP','Temp','Weight','Height','BMI','Pulse','SpO2','BP_Systolic','BP_Diastolic','Respiratory_Rate','O2_Saturation','Department','Mapped_Specialist','Symptoms','Site','Visit_Type','Recorded_By','Doctor_Name') THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_VISIT_FIELD';END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public."HIS_One_Visits"'::regclass AND attname=v_key AND attnum>0 AND NOT attisdropped) THEN
   IF v_key IN ('BP_Systolic','BP_Diastolic','Respiratory_Rate','O2_Saturation') THEN CONTINUE;END IF;
   RAISE EXCEPTION USING ERRCODE='42703',MESSAGE='VISIT_SCHEMA_NOT_READY';
  END IF;
  v_set=v_set||CASE WHEN v_set='' THEN '' ELSE ',' END||format('%I=($1).%I',v_key,v_key);
 END LOOP;
 IF v_set='' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='EMPTY_VISIT_UPDATE';END IF;
 v_vital=jsonb_populate_record(NULL::public."HIS_One_OPD_Vital_Signs",p_vital);
 INSERT INTO public."HIS_One_OPD_Vital_Signs" SELECT (v_vital).*;
 v_next=jsonb_populate_record(v_visit,p_visit);
 EXECUTE 'UPDATE public."HIS_One_Visits" SET '||v_set||' WHERE "Visit_ID"=$2 AND "Patient_ID"=$3 RETURNING *'
 INTO v_next USING v_next,v_visit."Visit_ID",v_visit."Patient_ID";
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='VISIT_UPDATE_DENIED';END IF;
 v_response=jsonb_build_object('success',true,'request_id',p_request_id,'visit',to_jsonb(v_next));
 INSERT INTO public.his_one_triage_save_receipts(request_id,user_id,payload,response) VALUES(p_request_id,auth.uid(),v_payload,v_response);
 RETURN v_response;
END $$;
REVOKE ALL ON FUNCTION public.his_one_save_triage_atomic(text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.his_one_save_triage_atomic(text,jsonb,jsonb,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
