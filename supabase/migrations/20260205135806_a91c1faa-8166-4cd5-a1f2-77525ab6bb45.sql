
-- PRODUÇÃO: Adicionar 'pix_payment' como tipo de referência válido
-- Necessário para o sistema de cobrança PIX antes de emissão fiscal

ALTER TABLE public.fiscal_wallet_transactions 
DROP CONSTRAINT IF EXISTS fiscal_wallet_transactions_reference_type_check;

ALTER TABLE public.fiscal_wallet_transactions 
ADD CONSTRAINT fiscal_wallet_transactions_reference_type_check 
CHECK (reference_type = ANY (ARRAY[
  'package_purchase'::text, 
  'single_purchase'::text, 
  'emission'::text, 
  'emission_refund'::text, 
  'admin_adjustment'::text, 
  'promotional_credit'::text,
  'pix_payment'::text,
  'pix_paid'::text
]));
