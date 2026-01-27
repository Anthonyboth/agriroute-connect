-- Tighten access controls for sensitive customer/profile and payment data
-- Fixes security findings: profiles_table_public_exposure, freight_payments_exposure

BEGIN;

-- -----------------------------------------------------------------------------
-- PROFILES: ensure strict RLS + remove any anon grants
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Remove any direct table access from anonymous users
REVOKE ALL ON TABLE public.profiles FROM anon;

-- Also remove any access from anon to the secure view (defense-in-depth)
REVOKE ALL ON TABLE public.profiles_secure FROM anon;

-- -----------------------------------------------------------------------------
-- FREIGHT PAYMENTS: ensure strict RLS + policies are authenticated-only + remove anon grants
-- -----------------------------------------------------------------------------
ALTER TABLE public.freight_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_payments FORCE ROW LEVEL SECURITY;

-- Ensure the RLS policies are not assigned to the implicit "public" role
-- (public includes anon; even if auth.uid() is null, we should not allow anon to hit these endpoints)
ALTER POLICY "Users can view their payments" ON public.freight_payments TO authenticated;
ALTER POLICY "Authenticated users can create payments" ON public.freight_payments TO authenticated;

-- Remove any direct table/view access from anonymous users
REVOKE ALL ON TABLE public.freight_payments FROM anon;
REVOKE ALL ON TABLE public.freight_payments_secure FROM anon;

COMMIT;