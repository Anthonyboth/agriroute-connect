-- ============================================
-- P0 FIX: Selfie persistence + tighten payments secure view
-- 1) Ensure dedicated private bucket for identity selfies
-- 2) Add strict storage policies for authenticated users (own folder) + admins
-- 3) Recreate freight_payments_secure view as SECURITY INVOKER so underlying RLS applies
-- ============================================

-- 1) Private bucket for selfies (no public access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-selfies', 'identity-selfies', false)
ON CONFLICT (id)
DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

-- 2) Storage policies for identity-selfies
-- Path convention: selfies/{auth.uid()}/selfie_*.jpg

DROP POLICY IF EXISTS "Identity selfies - users can upload own" ON storage.objects;
DROP POLICY IF EXISTS "Identity selfies - users can view own" ON storage.objects;
DROP POLICY IF EXISTS "Identity selfies - users can update own" ON storage.objects;
DROP POLICY IF EXISTS "Identity selfies - users can delete own" ON storage.objects;
DROP POLICY IF EXISTS "Identity selfies - admins manage" ON storage.objects;

CREATE POLICY "Identity selfies - users can upload own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'identity-selfies'
  AND (storage.foldername(name))[1] = 'selfies'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Identity selfies - users can view own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'identity-selfies'
  AND (storage.foldername(name))[1] = 'selfies'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Identity selfies - users can update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'identity-selfies'
  AND (storage.foldername(name))[1] = 'selfies'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'identity-selfies'
  AND (storage.foldername(name))[1] = 'selfies'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Identity selfies - users can delete own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'identity-selfies'
  AND (storage.foldername(name))[1] = 'selfies'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Identity selfies - admins manage"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'identity-selfies' AND is_admin())
WITH CHECK (bucket_id = 'identity-selfies' AND is_admin());

-- 3) Fix: freight_payments_secure view must not bypass RLS
-- Recreate as security_invoker so SELECT respects caller role and underlying RLS.
DROP VIEW IF EXISTS public.freight_payments_secure;

CREATE VIEW public.freight_payments_secure
WITH (security_invoker = true)
AS
SELECT
  fp.id,
  fp.freight_id,
  fp.payer_id,
  fp.receiver_id,
  fp.amount,
  fp.payment_type,
  fp.payment_method,
  fp.status,
  fp.completed_at,
  fp.created_at,
  fp.updated_at,
  CASE
    WHEN fp.stripe_payment_intent_id IS NOT NULL THEN 'pi_****' || right(fp.stripe_payment_intent_id, 4)
    ELSE NULL
  END AS stripe_payment_intent_masked,
  CASE
    WHEN fp.stripe_session_id IS NOT NULL THEN 'cs_****' || right(fp.stripe_session_id, 4)
    ELSE NULL
  END AS stripe_session_masked,
  CASE
    WHEN fp.external_transaction_id IS NOT NULL THEN 'ext_****' || right(fp.external_transaction_id, 4)
    ELSE NULL
  END AS external_transaction_masked
FROM public.freight_payments fp;

-- Explicit grants on the view
REVOKE ALL ON public.freight_payments_secure FROM anon;
REVOKE ALL ON public.freight_payments_secure FROM public;
GRANT SELECT ON public.freight_payments_secure TO authenticated;
