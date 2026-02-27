-- =============================================================================
-- SECURITY HARDENING: Fix error-level findings
-- =============================================================================

-- 1. DRIVER_STRIPE_ACCOUNTS: Create secure view masking stripe_account_id and pix_key
DROP VIEW IF EXISTS public.driver_stripe_accounts_secure;

CREATE VIEW public.driver_stripe_accounts_secure
WITH (security_invoker = true)
AS
SELECT
  id,
  driver_id,
  CASE 
    WHEN stripe_account_id IS NOT NULL THEN concat('acct_****', right(stripe_account_id, 4))
    ELSE NULL
  END AS stripe_account_id_masked,
  account_status,
  CASE 
    WHEN pix_key IS NOT NULL THEN concat(left(pix_key, 3), '****', right(pix_key, 2))
    ELSE NULL
  END AS pix_key_masked,
  charges_enabled,
  payouts_enabled,
  requirements_due,
  created_at,
  updated_at
FROM driver_stripe_accounts;

COMMENT ON VIEW public.driver_stripe_accounts_secure IS 
'Secure view for driver_stripe_accounts that masks stripe_account_id and pix_key.';

GRANT SELECT ON public.driver_stripe_accounts_secure TO authenticated;

-- 2. FISCAL_CERTIFICATES: CLS on password_hash, encryption_key_id
REVOKE SELECT (password_hash) ON public.fiscal_certificates FROM authenticated;
REVOKE SELECT (encryption_key_id) ON public.fiscal_certificates FROM authenticated;

-- 3. DRIVER_STRIPE_ACCOUNTS: CLS on stripe_account_id, pix_key
REVOKE SELECT (stripe_account_id) ON public.driver_stripe_accounts FROM authenticated;
REVOKE SELECT (pix_key) ON public.driver_stripe_accounts FROM authenticated;

-- 4. FREIGHT_PAYMENTS: CLS on Stripe identifiers
REVOKE SELECT (stripe_session_id) ON public.freight_payments FROM authenticated;
REVOKE SELECT (stripe_payment_intent_id) ON public.freight_payments FROM authenticated;
REVOKE SELECT (external_transaction_id) ON public.freight_payments FROM authenticated;

-- 5. BALANCE_TRANSACTIONS: CLS on Stripe identifiers
REVOKE SELECT (stripe_payment_intent_id) ON public.balance_transactions FROM authenticated;
REVOKE SELECT (stripe_payout_id) ON public.balance_transactions FROM authenticated;