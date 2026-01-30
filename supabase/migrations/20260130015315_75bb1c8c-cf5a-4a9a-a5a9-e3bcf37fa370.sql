-- Prevent exposing sensitive certificate columns to client roles
-- (Edge Functions using service_role remain unaffected)

BEGIN;

-- Ensure least-privilege: clients should never read storage paths or password hashes
REVOKE SELECT (storage_path) ON TABLE public.fiscal_certificates FROM anon;
REVOKE SELECT (storage_path) ON TABLE public.fiscal_certificates FROM authenticated;

REVOKE SELECT (password_hash) ON TABLE public.fiscal_certificates FROM anon;
REVOKE SELECT (password_hash) ON TABLE public.fiscal_certificates FROM authenticated;

COMMIT;