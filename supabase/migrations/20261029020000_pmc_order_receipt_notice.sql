-- Local preparation: physician order receipt notice only; no prescription or stock mutation.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';

CREATE TABLE pmc.his_pmc_order_receipts (
 event_id uuid PRIMARY KEY,
 patient_id text NOT NULL CHECK(patient_id ~ '^[A-Za-z0-9_-]{1,120}$'),
 visit_id text NOT NULL CHECK(visit_id ~ '^[A-Za-z0-9_-]{1,120}$'),
 encounter_revision bigint NOT NULL CHECK(encounter_revision BETWEEN 1 AND 9007199254740991),
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(patient_id,visit_id,encounter_revision)
);
ALTER TABLE pmc.his_pmc_order_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pmc.his_pmc_order_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.pmc_record_order_receipt_v1(p_event_id uuid,p_patient_id text,p_visit_id text,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE saved pmc.his_pmc_order_receipts;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_event_id IS NULL OR coalesce(p_patient_id,'') !~ '^[A-Za-z0-9_-]{1,120}$'
 OR coalesce(p_visit_id,'') !~ '^[A-Za-z0-9_-]{1,120}$' OR p_revision IS NULL OR p_revision NOT BETWEEN 1 AND 9007199254740991
 THEN RAISE EXCEPTION 'INVALID_RECEIPT' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."HIS_One_Visits" v WHERE v."Patient_ID"=p_patient_id AND v."Visit_ID"=p_visit_id AND v."EMR_Revision">=p_revision)
 THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND' USING ERRCODE='22023'; END IF;
 INSERT INTO pmc.his_pmc_order_receipts(event_id,patient_id,visit_id,encounter_revision)
 VALUES(p_event_id,p_patient_id,p_visit_id,p_revision) ON CONFLICT DO NOTHING;
 SELECT * INTO saved FROM pmc.his_pmc_order_receipts WHERE event_id=p_event_id;
 IF NOT FOUND OR saved.patient_id<>p_patient_id OR saved.visit_id<>p_visit_id OR saved.encounter_revision<>p_revision
 THEN RAISE EXCEPTION 'CONFLICTING_EVENT' USING ERRCODE='23505'; END IF;
 RETURN jsonb_build_object('status','ACKNOWLEDGED','eventId',saved.event_id);
END $$;

CREATE FUNCTION public.pmc_order_receipts_v1(p_patient_id text,p_visit_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL OR public.his_one_is_active_user() IS NOT TRUE
 OR coalesce(public.his_one_current_role(),'') NOT IN ('admin','doctor') OR public.his_one_has_action('opd','edit') IS NOT TRUE
 THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF coalesce(p_patient_id,'') !~ '^[A-Za-z0-9_-]{1,120}$' OR coalesce(p_visit_id,'') !~ '^[A-Za-z0-9_-]{1,120}$'
 THEN RAISE EXCEPTION 'INVALID_IDENTITY' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."HIS_One_Visits" v WHERE v."Patient_ID"=p_patient_id AND v."Visit_ID"=p_visit_id)
 THEN RETURN '[]'::jsonb; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('eventId',r.event_id,'revision',r.encounter_revision,'receivedAt',r.received_at) ORDER BY r.received_at DESC),'[]'::jsonb)
 FROM (SELECT event_id,encounter_revision,received_at FROM pmc.his_pmc_order_receipts WHERE patient_id=p_patient_id AND visit_id=p_visit_id ORDER BY received_at DESC LIMIT 100) r);
END $$;

REVOKE ALL ON FUNCTION public.pmc_record_order_receipt_v1(uuid,text,text,bigint),public.pmc_order_receipts_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.pmc_record_order_receipt_v1(uuid,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.pmc_order_receipts_v1(text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
