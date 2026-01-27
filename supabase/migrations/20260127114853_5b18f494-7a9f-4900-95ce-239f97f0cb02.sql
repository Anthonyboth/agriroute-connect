-- Security hardening: remove anonymous (unauthenticated) read access to sensitive tables/views
-- This reduces public data-harvesting surface even if RLS is misconfigured.

-- Profiles (PII)
REVOKE SELECT ON TABLE public.profiles FROM anon;
REVOKE SELECT ON TABLE public.profiles_secure FROM anon;

-- Vehicles (plates & document URLs via secure view)
REVOKE SELECT ON TABLE public.vehicles FROM anon;
REVOKE SELECT ON TABLE public.vehicles_secure FROM anon;

-- Service requests (contact data is masked in secure view, but should not be public)
REVOKE SELECT ON TABLE public.service_requests FROM anon;
REVOKE SELECT ON TABLE public.service_requests_secure FROM anon;

-- Financial data (masked identifiers in secure view, but should not be public)
REVOKE SELECT ON TABLE public.balance_transactions FROM anon;
REVOKE SELECT ON TABLE public.balance_transactions_secure FROM anon;

-- Ensure authenticated users keep read access to the secure views
GRANT SELECT ON TABLE public.profiles_secure TO authenticated;
GRANT SELECT ON TABLE public.vehicles_secure TO authenticated;
GRANT SELECT ON TABLE public.service_requests_secure TO authenticated;
GRANT SELECT ON TABLE public.balance_transactions_secure TO authenticated;
