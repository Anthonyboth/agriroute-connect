-- =============================================
-- SECURITY FIX: fiscal_certificates_storage_exposure
-- Drop and recreate secure view that hides sensitive infrastructure fields
-- =============================================

-- Drop existing view first to avoid column name conflicts
DROP VIEW IF EXISTS public.fiscal_certificates_secure;

-- Create secure view for fiscal_certificates that hides sensitive fields
CREATE VIEW public.fiscal_certificates_secure
WITH (security_invoker = true)
AS
SELECT
  id,
  issuer_id,
  certificate_type,
  serial_number,
  issuer_cn,
  subject_cn,
  subject_document,
  valid_from,
  valid_until,
  is_valid,
  is_expired,
  -- HIDE storage_path - only show boolean indicating if certificate is stored
  (storage_path IS NOT NULL) AS has_certificate_file,
  -- HIDE password_hash completely - sensitive
  -- HIDE encryption_key_id - infrastructure detail
  purchased_via_platform,
  purchase_order_id,
  purchase_provider,
  purchase_amount,
  purchase_date,
  status,
  validation_error,
  last_used_at,
  usage_count,
  uploaded_at,
  uploaded_by,
  created_at,
  updated_at
FROM public.fiscal_certificates;

-- Grant access to authenticated users (RLS from base table applies)
GRANT SELECT ON public.fiscal_certificates_secure TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.fiscal_certificates_secure IS 
'Secure view for fiscal_certificates that hides sensitive infrastructure fields (storage_path, password_hash, encryption_key_id). Use this view for all client-facing queries.';

-- =============================================
-- Ensure cities table has proper unique constraint for deduplication
-- =============================================

-- Add ibge_code unique constraint if not exists (for deduplication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'cities_ibge_code_unique'
  ) THEN
    CREATE UNIQUE INDEX cities_ibge_code_unique ON public.cities(ibge_code) WHERE ibge_code IS NOT NULL;
  END IF;
END $$;