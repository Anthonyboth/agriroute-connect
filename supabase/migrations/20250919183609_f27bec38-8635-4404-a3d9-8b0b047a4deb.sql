-- Corrigir função check_advance_payment_requirement com search_path seguro
CREATE OR REPLACE FUNCTION check_advance_payment_requirement()
RETURNS TRIGGER AS $$
DECLARE
  pending_advances_count INTEGER;
  approved_advances_count INTEGER;
BEGIN
  -- Se o status mudou para LOADED, verificar adiantamentos
  IF NEW.status = 'LOADED' AND OLD.status != 'LOADED' THEN
    -- Contar adiantamentos pendentes
    SELECT COUNT(*) INTO pending_advances_count
    FROM freight_advances 
    WHERE freight_id = NEW.id AND status = 'PENDING';
    
    -- Contar adiantamentos já aprovados/pagos  
    SELECT COUNT(*) INTO approved_advances_count
    FROM freight_advances 
    WHERE freight_id = NEW.id AND status IN ('APPROVED', 'PAID');
    
    -- Se há adiantamentos pendentes e nenhum foi aprovado ainda, criar notificação obrigatória
    IF pending_advances_count > 0 AND approved_advances_count = 0 THEN
      -- Inserir notificação para o produtor
      INSERT INTO notifications (
        user_id, 
        title, 
        message, 
        type,
        data
      ) VALUES (
        NEW.producer_id,
        'Pagamento de Adiantamento Obrigatório',
        'Sua carga foi carregada. Você deve aprovar pelo menos um adiantamento antes de prosseguir.',
        'advance_payment_required',
        jsonb_build_object(
          'freight_id', NEW.id,
          'pending_advances', pending_advances_count,
          'requires_action', true
        )
      );
      
      -- Adicionar flag no frete indicando que requer pagamento de adiantamento
      NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('advance_payment_required', true);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Corrigir função remove_advance_payment_requirement com search_path seguro
CREATE OR REPLACE FUNCTION remove_advance_payment_requirement()
RETURNS TRIGGER AS $$
DECLARE
  freight_record RECORD;
BEGIN
  -- Se um adiantamento foi aprovado/pago
  IF NEW.status IN ('APPROVED', 'PAID') AND OLD.status = 'PENDING' THEN
    -- Buscar o frete relacionado
    SELECT * INTO freight_record FROM freights WHERE id = NEW.freight_id;
    
    -- Se o frete estava requerendo pagamento de adiantamento, remover a obrigatoriedade
    IF freight_record.metadata->>'advance_payment_required' = 'true' THEN
      -- Remover flag de obrigatoriedade
      UPDATE freights 
      SET metadata = freight_record.metadata - 'advance_payment_required'
      WHERE id = NEW.freight_id;
      
      -- Marcar notificações relacionadas como lidas
      UPDATE notifications 
      SET read = true 
      WHERE user_id = freight_record.producer_id 
        AND type = 'advance_payment_required'
        AND data->>'freight_id' = NEW.freight_id::text;
        
      -- Criar notificação de confirmação
      INSERT INTO notifications (
        user_id, 
        title, 
        message, 
        type,
        data
      ) VALUES (
        freight_record.producer_id,
        'Adiantamento Aprovado',
        'Obrigação de pagamento de adiantamento cumprida. Você pode prosseguir com o frete.',
        'advance_payment_completed',
        jsonb_build_object('freight_id', NEW.freight_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';