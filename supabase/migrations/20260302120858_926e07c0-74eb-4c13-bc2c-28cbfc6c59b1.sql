
-- ============================================================
-- Column-Level Security: Hide password_hash, encryption_key_id, 
-- storage_path from direct SELECT on fiscal_certificates
-- Access these safely via fiscal_certificates_secure view
-- ============================================================

-- Step 1: Revoke ALL column-level SELECT, then re-grant only safe columns
REVOKE SELECT ON public.fiscal_certificates FROM authenticated, anon;

-- Step 2: Grant SELECT on non-sensitive columns to authenticated
GRANT SELECT (
  id, issuer_id, certificate_type, serial_number, issuer_cn, subject_cn,
  subject_document, valid_from, valid_until, is_valid, is_expired,
  purchased_via_platform, purchase_order_id, purchase_provider,
  purchase_amount, purchase_date, status, validation_error,
  last_used_at, usage_count, uploaded_at, uploaded_by, created_at, updated_at
) ON public.fiscal_certificates TO authenticated;

-- Step 3: Ensure anon has NO access at all
REVOKE ALL ON public.fiscal_certificates FROM anon;

-- Step 4: Keep INSERT/UPDATE/DELETE for authenticated (they need to manage their certs)
GRANT INSERT, UPDATE, DELETE ON public.fiscal_certificates TO authenticated;
