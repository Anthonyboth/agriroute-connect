
-- Revogar SELECT em nível de tabela para authenticated
REVOKE SELECT ON public.freight_payments FROM authenticated;

-- Conceder SELECT apenas em colunas não-sensíveis
GRANT SELECT (
  id,
  freight_id,
  payer_id,
  receiver_id,
  amount,
  payment_type,
  payment_method,
  status,
  metadata,
  created_at,
  updated_at,
  completed_at
) ON public.freight_payments TO authenticated;

-- Stripe IDs (stripe_payment_intent_id, stripe_session_id, external_transaction_id)
-- ficam acessíveis SOMENTE via freight_payments_secure view (com mascaramento)

-- Garantir que anon não tem acesso
REVOKE ALL ON public.freight_payments FROM anon;
