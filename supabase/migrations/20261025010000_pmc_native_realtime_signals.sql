-- Isolated doctor-prescription change signals. No clinical table is published.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='HIS_One_Visits' AND c.relrowsecurity) THEN
  RAISE EXCEPTION 'SOURCE_RLS_REQUIRED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime' AND NOT puballtables AND pubinsert) THEN
  RAISE EXCEPTION 'SCOPED_REALTIME_PUBLICATION_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='HIS_One_Visits') THEN
  RAISE EXCEPTION 'CLINICAL_REALTIME_REQUIRES_REVIEW';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='pmc') AND NOT has_schema_privilege('authenticated','pmc','USAGE') THEN
  RAISE EXCEPTION 'PMC_SCHEMA_SCOPE_REVIEW_REQUIRED';
 END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS pmc;
CREATE TABLE IF NOT EXISTS pmc.his_prescription_signals(
 signal_seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 "Patient_ID" text NOT NULL CHECK("Patient_ID" ~ '^[A-Za-z0-9_-]{1,120}$'),
 "Visit_ID" text NOT NULL CHECK("Visit_ID" ~ '^[A-Za-z0-9_-]{1,120}$'),
 "EMR_Revision" bigint NOT NULL CHECK("EMR_Revision" BETWEEN 1 AND 9007199254740991),
 source_action text NOT NULL CHECK(source_action IN ('INSERT','UPDATE','DELETE')),
 source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
 actor_id uuid NOT NULL,
 source_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS pmc_his_signal_xid ON pmc.his_prescription_signals(source_xid,signal_seq);
ALTER TABLE pmc.his_prescription_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pmc.his_prescription_signals FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE pmc.his_prescription_signals_signal_seq_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA pmc TO authenticated;
GRANT SELECT ON pmc.his_prescription_signals TO authenticated;
DROP POLICY IF EXISTS pmc_native_pharmacy_signal_read ON pmc.his_prescription_signals;
CREATE POLICY pmc_native_pharmacy_signal_read ON pmc.his_prescription_signals FOR SELECT TO authenticated
 USING(auth.uid() IS NOT NULL AND public.his_one_is_active_user() AND public.his_one_current_role() IN ('admin','pharmacy'));

-- Delivery acknowledgements are per in-memory browser consumer, not order acceptance.
CREATE TABLE IF NOT EXISTS pmc.his_signal_consumers(
 id uuid PRIMARY KEY,reader_id uuid NOT NULL,baseline pg_snapshot NOT NULL DEFAULT pg_current_snapshot(),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pmc.his_signal_deliveries(
 consumer_id uuid NOT NULL REFERENCES pmc.his_signal_consumers(id),
 signal_seq bigint NOT NULL REFERENCES pmc.his_prescription_signals(signal_seq),
 delivered_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(consumer_id,signal_seq)
);
ALTER TABLE pmc.his_signal_consumers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pmc.his_signal_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pmc.his_signal_consumers,pmc.his_signal_deliveries FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION pmc.capture_his_prescription_signal_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pmc AS $$
DECLARE source_row jsonb; payload text; lines jsonb; revision bigint;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
  OR public.his_one_is_active_user() IS NOT TRUE OR coalesce(public.his_one_current_role(),'') NOT IN ('admin','doctor') THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)->'Prescription_JSON') IS NOT DISTINCT FROM (to_jsonb(OLD)->'Prescription_JSON') THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN source_row:=to_jsonb(OLD); ELSE source_row:=to_jsonb(NEW); END IF;
 IF coalesce(source_row->>'Patient_ID','') !~ '^[A-Za-z0-9_-]{1,120}$'
  OR coalesce(source_row->>'Visit_ID','') !~ '^[A-Za-z0-9_-]{1,120}$'
  OR coalesce(source_row->>'EMR_Revision','') !~ '^[0-9]{1,16}$' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 revision:=(source_row->>'EMR_Revision')::bigint;
 IF revision NOT BETWEEN 1 AND 9007199254740991 THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 payload:=coalesce(source_row->>'Prescription_JSON','');
 BEGIN lines:=payload::jsonb; EXCEPTION WHEN invalid_text_representation THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END;
 IF jsonb_typeof(lines) IS DISTINCT FROM 'array' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF jsonb_array_length(lines)>100 THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 -- Clearing an existing prescription also invalidates readers; empty new visits do not.
 IF jsonb_array_length(lines)=0 AND TG_OP='INSERT' THEN RETURN NEW; END IF;
 INSERT INTO pmc.his_prescription_signals("Patient_ID","Visit_ID","EMR_Revision",source_action,source_digest,actor_id)
 VALUES(source_row->>'Patient_ID',source_row->>'Visit_ID',revision,TG_OP,encode(sha256(convert_to(payload,'UTF8')),'hex'),auth.uid());
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pmc.capture_his_prescription_signal_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS pmc_capture_native_prescription_signal ON public."HIS_One_Visits";
CREATE TRIGGER pmc_capture_native_prescription_signal AFTER INSERT OR UPDATE OF "Prescription_JSON" OR DELETE ON public."HIS_One_Visits"
 FOR EACH ROW EXECUTE FUNCTION pmc.capture_his_prescription_signal_v1();

CREATE OR REPLACE FUNCTION public.pmc_his_signal_batch_v1(p_consumer uuid,p_ack bigint[] DEFAULT '{}',p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pmc AS $$
DECLARE events jsonb; more boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
  OR public.his_one_is_active_user() IS NOT TRUE OR coalesce(public.his_one_current_role(),'') NOT IN ('admin','pharmacy') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_consumer IS NULL OR p_ack IS NULL OR cardinality(p_ack)>100 OR EXISTS(SELECT 1 FROM unnest(p_ack) id WHERE id IS NULL OR id<1 OR id>9007199254740991) OR p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'INVALID_BATCH' USING ERRCODE='22023'; END IF;
 INSERT INTO pmc.his_signal_consumers(id,reader_id) VALUES(p_consumer,auth.uid()) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM pmc.his_signal_consumers WHERE id=p_consumer AND reader_id=auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO pmc.his_signal_deliveries(consumer_id,signal_seq)
 SELECT p_consumer,s.signal_seq FROM pmc.his_prescription_signals s WHERE s.signal_seq=ANY(p_ack)
 ON CONFLICT DO NOTHING;
 -- Do not use a high-water sequence cursor: concurrent transactions can commit out of order.
 WITH page AS MATERIALIZED(
  SELECT s.signal_seq,s."Patient_ID",s."Visit_ID",s."EMR_Revision",s.source_action FROM pmc.his_prescription_signals s
  JOIN pmc.his_signal_consumers c ON c.id=p_consumer
  WHERE s.source_xid>=pg_snapshot_xmin(c.baseline) AND NOT pg_visible_in_snapshot(s.source_xid,c.baseline)
   AND NOT EXISTS(SELECT 1 FROM pmc.his_signal_deliveries d WHERE d.consumer_id=p_consumer AND d.signal_seq=s.signal_seq)
  ORDER BY s.signal_seq LIMIT p_limit+1
 ), visible AS(SELECT * FROM page ORDER BY signal_seq LIMIT p_limit)
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('signalId',signal_seq,'patientId',"Patient_ID",'visitId',"Visit_ID",'revision',"EMR_Revision",'action',source_action) ORDER BY signal_seq) FROM visible),'[]'::jsonb),
  (SELECT count(*)>p_limit FROM page) INTO events,more;
 RETURN jsonb_build_object('events',events,'hasMore',more);
END $$;
REVOKE ALL ON FUNCTION public.pmc_his_signal_batch_v1(uuid,bigint[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pmc_his_signal_batch_v1(uuid,bigint[],integer) TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='pmc' AND tablename='his_prescription_signals') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE pmc.his_prescription_signals;
 END IF;
END $$;
COMMIT;
