-- Emergency rollback after separate activation approval. Retain all signal/history data.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
ALTER TABLE public."HIS_One_Visits" DISABLE TRIGGER pmc_capture_native_prescription_signal;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='pmc' AND tablename='his_prescription_signals') THEN
  ALTER PUBLICATION supabase_realtime DROP TABLE pmc.his_prescription_signals;
 END IF;
END $$;
COMMIT;
