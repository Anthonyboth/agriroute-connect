
DROP VIEW IF EXISTS public.balance_transactions_secure;

CREATE VIEW public.balance_transactions_secure
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  bt.id,
  bt.provider_id,
  bt.amount,
  bt.balance_before,
  bt.balance_after,
  bt.transaction_type,
  bt.status,
  bt.description,
  bt.reference_id,
  bt.reference_type,
  CASE
    WHEN is_admin() THEN bt.stripe_payment_intent_id
    WHEN bt.stripe_payment_intent_id IS NOT NULL THEN '***' || RIGHT(bt.stripe_payment_intent_id, 4)
    ELSE NULL
  END AS stripe_payment_intent_id,
  CASE
    WHEN is_admin() THEN bt.stripe_payout_id
    WHEN bt.stripe_payout_id IS NOT NULL THEN '***' || RIGHT(bt.stripe_payout_id, 4)
    ELSE NULL
  END AS stripe_payout_id,
  bt.metadata,
  bt.created_at,
  bt.updated_at
FROM public.balance_transactions bt;

GRANT SELECT ON public.balance_transactions_secure TO authenticated;
