-- Resolve actionable Supabase Security Advisor findings that can be changed
-- without disrupting the transitional frontend.
DO $$
BEGIN
  IF to_regclass('public.opd_active_observations_by_bed') IS NOT NULL THEN
    ALTER VIEW public.opd_active_observations_by_bed SET (security_invoker = true);
  END IF;

  IF to_regprocedure('public.set_lis_one_outlab_orders_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.set_lis_one_outlab_orders_updated_at() SET search_path = public;
  END IF;
  IF to_regprocedure('public.set_opd_observation_duration()') IS NOT NULL THEN
    ALTER FUNCTION public.set_opd_observation_duration() SET search_path = public;
  END IF;

  IF to_regprocedure('public.his_one_generate_am_id(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.his_one_generate_am_id(text) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.his_one_generate_am_id(text) TO authenticated, service_role;
  END IF;
END
$$;
