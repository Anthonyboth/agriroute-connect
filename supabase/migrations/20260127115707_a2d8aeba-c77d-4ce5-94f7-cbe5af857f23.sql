-- Security hardening: ensure invoice emission records are not readable by unauthenticated users
-- This addresses the supabase_lov finding that `nfe_emissions` is publicly readable.

REVOKE SELECT ON TABLE public.nfe_emissions FROM anon;

-- In case a secure view exists, ensure it is not publicly readable either
DO $$
BEGIN
  IF to_regclass('public.nfe_emissions_secure') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON TABLE public.nfe_emissions_secure FROM anon';
  END IF;
END
$$;
