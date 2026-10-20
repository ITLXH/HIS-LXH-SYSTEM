-- Add the currency field expected by LIS without rewriting amounts or access rules.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $repair$ BEGIN
  IF to_regclass('public.lis_one_outlab_orders') IS NULL THEN
    RAISE EXCEPTION 'OUTLAB_TABLE_MISSING_REVIEW_REQUIRED';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='lis_one_outlab_orders'
        AND column_name='send_currency' AND data_type <> 'text') THEN
    RAISE EXCEPTION 'OUTLAB_CURRENCY_TYPE_DRIFT';
  END IF;
END $repair$;
-- Existing LIS compatibility code treats a missing currency as LAK.
-- A constant DEFAULT uses PostgreSQL's metadata-only fast path for old rows.
ALTER TABLE public.lis_one_outlab_orders
  ADD COLUMN IF NOT EXISTS send_currency text DEFAULT 'LAK';
NOTIFY pgrst, 'reload schema';
COMMIT;
