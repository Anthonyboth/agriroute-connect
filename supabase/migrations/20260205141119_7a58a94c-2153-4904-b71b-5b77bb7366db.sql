-- FIX: Adicionar 'pix_pending' e 'pix_paid' como tipos de transação válidos
-- Necessário para o fluxo de cobrança PIX antes da emissão fiscal

ALTER TABLE public.fiscal_wallet_transactions 
DROP CONSTRAINT IF EXISTS fiscal_wallet_transactions_transaction_type_check;

ALTER TABLE public.fiscal_wallet_transactions 
ADD CONSTRAINT fiscal_wallet_transactions_transaction_type_check 
CHECK (transaction_type = ANY (ARRAY[
  'credit'::text, 
  'debit'::text, 
  'reserve'::text, 
  'release'::text, 
  'refund'::text,
  'pix_pending'::text,
  'pix_paid'::text
]));