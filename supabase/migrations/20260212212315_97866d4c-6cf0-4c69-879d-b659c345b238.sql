
-- Corrigir notificação duplicada ao mudar status para DELIVERED_PENDING_CONFIRMATION
-- A função notify_producer_delivery() já trata esse caso com mais detalhes (deadline, metadata)
-- Remover o bloco duplicado de notify_freight_status_change()

CREATE OR REPLACE FUNCTION public.notify_freight_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_proposal BOOLEAN := FALSE;
BEGIN
  -- Frete em trânsito
  IF NEW.status = 'IN_TRANSIT' AND OLD.status != 'IN_TRANSIT' THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.producer_id,
      'Frete em trânsito',
      'Seu frete iniciou o transporte',
      'freight_in_transit',
      jsonb_build_object('freight_id', NEW.id)
    );
  END IF;
  
  -- REMOVIDO: bloco DELIVERED_PENDING_CONFIRMATION
  -- Já tratado pela função notify_producer_delivery() (trigger_notify_producer_delivery)
  -- que inclui deadline de 72h e metadata adicional
  
  -- Frete aceito - verificar se veio de proposta ou aceite direto
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' AND NEW.driver_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM freight_proposals 
      WHERE freight_id = NEW.id 
        AND driver_id = NEW.driver_id 
        AND status = 'ACCEPTED'
    ) INTO v_has_proposal;

    IF v_has_proposal THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.driver_id,
        'Frete aceito!',
        'Sua proposta foi aceita pelo produtor',
        'freight_accepted',
        jsonb_build_object('freight_id', NEW.id)
      );
    ELSE
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.driver_id,
        'Frete aceito!',
        'Você aceitou o frete com sucesso',
        'freight_accepted',
        jsonb_build_object('freight_id', NEW.id)
      );
    END IF;
  END IF;
  
  -- Frete entregue - solicitar avaliações
  IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' THEN
    IF NEW.driver_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.producer_id,
        'Avalie o motorista',
        'O frete foi entregue. Que tal avaliar o motorista?',
        'rating_pending',
        jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.driver_id)
      );
      
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.driver_id,
        'Avalie o produtor',
        'O frete foi entregue. Que tal avaliar o produtor?',
        'rating_pending',
        jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.producer_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
