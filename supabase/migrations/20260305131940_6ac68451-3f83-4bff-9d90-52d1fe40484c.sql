
DROP VIEW IF EXISTS public.freight_payments_secure;

CREATE VIEW public.freight_payments_secure
WITH (security_invoker = false, security_barrier = true)
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
  CASE
    WHEN is_admin() THEN fp.stripe_payment_intent_id
    WHEN fp.stripe_payment_intent_id IS NOT NULL THEN '***' || RIGHT(fp.stripe_payment_intent_id, 4)
    ELSE NULL
  END AS stripe_payment_intent_id,
  CASE
    WHEN is_admin() THEN fp.stripe_session_id
    WHEN fp.stripe_session_id IS NOT NULL THEN '***' || RIGHT(fp.stripe_session_id, 4)
    ELSE NULL
  END AS stripe_session_id,
  CASE
    WHEN is_admin() THEN fp.external_transaction_id
    WHEN fp.external_transaction_id IS NOT NULL THEN '***' || RIGHT(fp.external_transaction_id, 4)
    ELSE NULL
  END AS external_transaction_id,
  fp.metadata,
  fp.created_at,
  fp.updated_at,
  fp.completed_at
FROM public.freight_payments fp;

GRANT SELECT ON public.freight_payments_secure TO authenticated;

-- Deny UPDATE/DELETE for non-admin
DROP POLICY IF EXISTS "freight_payments_deny_update" ON public.freight_payments;
CREATE POLICY "freight_payments_deny_update"
  ON public.freight_payments
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "freight_payments_deny_delete" ON public.freight_payments;
CREATE POLICY "freight_payments_deny_delete"
  ON public.freight_payments
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);
