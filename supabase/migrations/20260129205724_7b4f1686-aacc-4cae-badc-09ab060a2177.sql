-- =====================================================
-- CORREÇÃO: Avaliação de frete deve ser permitida APENAS após pagamento confirmado
-- =====================================================

-- 1. Remover políticas antigas de INSERT em freight_ratings
DROP POLICY IF EXISTS "Users can create ratings for their freights" ON public.freight_ratings;
DROP POLICY IF EXISTS "freight_ratings_insert_authenticated" ON public.freight_ratings;

-- 2. Criar função para verificar se pagamento foi confirmado
CREATE OR REPLACE FUNCTION public.is_freight_payment_confirmed(p_freight_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM external_payments ep
    WHERE ep.freight_id = p_freight_id
    AND ep.status = 'confirmed'
  );
$$;

-- 3. Criar função para verificar se usuário é participante ativo do frete
CREATE OR REPLACE FUNCTION public.is_freight_participant_for_rating(p_freight_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM freights f
    JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE f.id = p_freight_id
    AND p.user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM freight_assignments fa
    JOIN profiles p ON fa.driver_id = p.id
    WHERE fa.freight_id = p_freight_id
    AND p.user_id = p_user_id
    AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  );
$$;

-- 4. Criar nova política de INSERT que verifica pagamento confirmado
CREATE POLICY "freight_ratings_insert_after_payment_confirmed"
ON public.freight_ratings FOR INSERT
TO authenticated
WITH CHECK (
  -- Usuário é participante do frete
  is_freight_participant_for_rating(freight_id, auth.uid())
  -- E rater_id pertence ao usuário autenticado
  AND rater_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  -- E o frete tem pagamento confirmado
  AND is_freight_payment_confirmed(freight_id)
);

-- 5. Garantir que o trigger de multi-carreta não mude status para DELIVERED se ainda há carretas pendentes
CREATE OR REPLACE FUNCTION public.prevent_premature_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tentando mudar para DELIVERED/COMPLETED e ainda há carretas pendentes
  IF (NEW.status IN ('DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION')) 
     AND NEW.required_trucks > 1 
     AND NEW.accepted_trucks < NEW.required_trucks THEN
    -- Não permitir - manter status anterior ou OPEN se estava OPEN
    RAISE NOTICE 'Frete multi-carreta % não pode ser entregue com apenas %/% carretas aceitas', 
      NEW.id, NEW.accepted_trucks, NEW.required_trucks;
    -- Permitir apenas se TODAS as atribuições foram entregues
    IF NOT EXISTS (
      SELECT 1 FROM freight_assignments fa
      WHERE fa.freight_id = NEW.id
      AND fa.status = 'DELIVERED'
      -- Verificar se há pelo menos uma entrega por carreta aceita
      HAVING COUNT(*) >= NEW.accepted_trucks
    ) THEN
      RETURN OLD; -- Manter status anterior
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger antigo se existir e criar novo
DROP TRIGGER IF EXISTS prevent_premature_delivery_trigger ON public.freights;
CREATE TRIGGER prevent_premature_delivery_trigger
  BEFORE UPDATE ON public.freights
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.prevent_premature_delivery();

-- 6. Adicionar comentários de documentação
COMMENT ON FUNCTION public.is_freight_payment_confirmed IS 
'Verifica se o frete tem pelo menos um pagamento confirmado. Usado para RLS de avaliações.';

COMMENT ON FUNCTION public.is_freight_participant_for_rating IS 
'Verifica se o usuário é participante do frete (produtor, motorista direto ou via assignment).';

COMMENT ON FUNCTION public.prevent_premature_delivery IS 
'Impede que fretes multi-carreta sejam marcados como entregues antes de todas as carretas serem contratadas e entregues.';