
-- ============================================================
-- CORREÇÃO DE SEGURANÇA: balance_transactions
-- Restrição temporal + mascaramento de dados históricos
-- ============================================================

-- 1. Substituir política SELECT para incluir restrição temporal (90 dias)
DROP POLICY IF EXISTS "balance_transactions_owner_only" ON public.balance_transactions;
CREATE POLICY "balance_transactions_owner_only"
ON public.balance_transactions FOR SELECT TO authenticated
USING (
  (provider_id = get_my_profile_id() AND created_at >= (now() - interval '90 days'))
  OR is_admin()
);

-- 2. Atualizar view segura com mascaramento de saldos em transações antigas (>30 dias)
CREATE OR REPLACE VIEW public.balance_transactions_secure 
WITH (security_invoker = true)
AS
SELECT 
  id,
  provider_id,
  transaction_type,
  amount,
  CASE
    WHEN created_at >= (now() - interval '30 days') THEN balance_before
    ELSE NULL
  END as balance_before,
  CASE
    WHEN created_at >= (now() - interval '30 days') THEN balance_after
    ELSE NULL
  END as balance_after,
  status,
  description,
  reference_type,
  reference_id,
  created_at,
  updated_at,
  CASE
    WHEN stripe_payment_intent_id IS NOT NULL THEN concat('pi_****', right(stripe_payment_intent_id, 4))
    ELSE NULL 
  END as stripe_payment_intent_id_masked,
  CASE
    WHEN stripe_payout_id IS NOT NULL THEN concat('po_****', right(stripe_payout_id, 4))
    ELSE NULL 
  END as stripe_payout_id_masked
FROM public.balance_transactions;

COMMENT ON VIEW public.balance_transactions_secure IS 
  'Secure view: masks Stripe IDs always, masks balance details for transactions older than 30 days. RLS limits access to 90 days for non-admins.';

-- 3. Manter grants existentes
GRANT SELECT ON public.balance_transactions_secure TO authenticated;
