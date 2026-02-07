-- =====================================================
-- FIX: service_payments - ON CONFLICT e CHECK constraint
-- =====================================================

-- 1. Adicionar UNIQUE constraint em service_request_id
-- Necessário para o ON CONFLICT (service_request_id) DO NOTHING da RPC
ALTER TABLE public.service_payments
  ADD CONSTRAINT service_payments_service_request_id_key 
  UNIQUE (service_request_id);

-- 2. Atualizar CHECK constraint de status para incluir os valores do workflow real:
-- proposed → paid_by_client → confirmed_by_provider
-- Mantém também os valores legacy por segurança
ALTER TABLE public.service_payments
  DROP CONSTRAINT IF EXISTS service_payments_status_check;

ALTER TABLE public.service_payments
  ADD CONSTRAINT service_payments_status_check 
  CHECK (status = ANY (ARRAY[
    'proposed'::text,
    'paid_by_client'::text, 
    'confirmed_by_provider'::text,
    'PENDING'::text, 
    'COMPLETED'::text, 
    'FAILED'::text, 
    'CANCELLED'::text
  ]));