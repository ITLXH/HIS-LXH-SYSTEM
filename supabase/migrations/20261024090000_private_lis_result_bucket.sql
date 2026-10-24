-- Paired HIS/LIS authenticated viewers must be deployed first.
-- Metadata-only change: objects and result metadata remain intact.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'order-result-files') THEN
    RAISE EXCEPTION 'Expected LIS result bucket is missing';
  END IF;
END $$;
UPDATE storage.buckets SET public = false WHERE id = 'order-result-files';
COMMIT;
