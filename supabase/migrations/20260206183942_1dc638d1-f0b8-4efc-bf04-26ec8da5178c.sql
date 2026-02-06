-- CORREÇÃO CRÍTICA: O check constraint atual só permite (proposed, accepted, rejected, confirmed)
-- mas o fluxo de pagamento usa 'paid_by_producer', 'cancelled' e 'disputed'
-- Isso faz com que TODAS as transições de pagamento falhem silenciosamente!

-- 1. Remover o constraint antigo
ALTER TABLE public.external_payments DROP CONSTRAINT IF EXISTS external_payments_status_check;

-- 2. Criar constraint com TODOS os status do fluxo de pagamento
ALTER TABLE public.external_payments ADD CONSTRAINT external_payments_status_check 
CHECK (status IN ('proposed', 'accepted', 'paid_by_producer', 'confirmed', 'rejected', 'cancelled', 'disputed'));

-- 3. Agora sim, cancelar o pagamento do frete cancelado
UPDATE public.external_payments 
SET status = 'cancelled', 
    notes = COALESCE(notes, '') || ' | Auto-cancelado: frete associado foi cancelado',
    updated_at = now()
WHERE id = 'cbcc11b1-841a-4d51-ae6e-9cffad871564';