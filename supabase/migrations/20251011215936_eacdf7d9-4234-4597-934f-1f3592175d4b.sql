-- Migration: Sistema de Notificações e Mensagens Não Lidas

-- 1. Adicionar coluna read_at às tabelas de mensagens
ALTER TABLE freight_messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE service_messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_freight_messages_unread 
ON freight_messages(freight_id, sender_id, read_at) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_messages_unread 
ON service_messages(service_request_id, sender_id, read_at) WHERE read_at IS NULL;

-- 3. Função para enviar notificação de nova mensagem (freight)
CREATE OR REPLACE FUNCTION notify_new_freight_message()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  freight_record RECORD;
  receiver_id UUID;
  recent_notification BOOLEAN;
BEGIN
  -- Buscar informações do frete
  SELECT producer_id, driver_id INTO freight_record
  FROM freights 
  WHERE id = NEW.freight_id;
  
  -- Determinar quem deve receber a notificação
  IF NEW.sender_id = freight_record.producer_id THEN
    receiver_id := freight_record.driver_id;
  ELSE
    receiver_id := freight_record.producer_id;
  END IF;
  
  IF receiver_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se já existe notificação recente (últimos 5 minutos)
  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = receiver_id
    AND type = 'chat_message'
    AND data->>'freight_id' = NEW.freight_id::text
    AND created_at > now() - interval '5 minutes'
  ) INTO recent_notification;
  
  -- Inserir notificação apenas se não houver uma recente
  IF NOT recent_notification THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      receiver_id,
      'Nova mensagem no chat',
      'Você recebeu uma nova mensagem no chat do frete',
      'chat_message',
      jsonb_build_object(
        'freight_id', NEW.freight_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar trigger para mensagens de frete
DROP TRIGGER IF EXISTS trigger_notify_freight_message ON freight_messages;
CREATE TRIGGER trigger_notify_freight_message
AFTER INSERT ON freight_messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_freight_message();

-- 5. Função para enviar notificação de nova mensagem (service)
CREATE OR REPLACE FUNCTION notify_new_service_message()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  service_record RECORD;
  receiver_id UUID;
  recent_notification BOOLEAN;
BEGIN
  SELECT client_id, provider_id INTO service_record
  FROM service_requests 
  WHERE id = NEW.service_request_id;
  
  IF NEW.sender_id = service_record.client_id THEN
    receiver_id := service_record.provider_id;
  ELSE
    receiver_id := service_record.client_id;
  END IF;
  
  IF receiver_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar notificação recente
  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = receiver_id
    AND type = 'service_chat_message'
    AND data->>'service_request_id' = NEW.service_request_id::text
    AND created_at > now() - interval '5 minutes'
  ) INTO recent_notification;
  
  IF NOT recent_notification THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      receiver_id,
      'Nova mensagem no chat',
      'Você recebeu uma nova mensagem no chat do serviço',
      'service_chat_message',
      jsonb_build_object(
        'service_request_id', NEW.service_request_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Criar trigger para mensagens de serviço
DROP TRIGGER IF EXISTS trigger_notify_service_message ON service_messages;
CREATE TRIGGER trigger_notify_service_message
AFTER INSERT ON service_messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_service_message();

-- 7. Notificação de proposta recebida
CREATE OR REPLACE FUNCTION notify_proposal_received()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  producer_id UUID;
BEGIN
  IF NEW.status = 'PENDING' THEN
    SELECT f.producer_id INTO producer_id
    FROM freights f
    WHERE f.id = NEW.freight_id;
    
    IF producer_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        producer_id,
        'Nova proposta recebida',
        'Um motorista enviou uma proposta para seu frete',
        'proposal_received',
        jsonb_build_object('freight_id', NEW.freight_id, 'proposal_id', NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_proposal ON freight_proposals;
CREATE TRIGGER trigger_notify_proposal
AFTER INSERT ON freight_proposals
FOR EACH ROW
EXECUTE FUNCTION notify_proposal_received();

-- 8. Notificação de mudança de status do frete
CREATE OR REPLACE FUNCTION notify_freight_status_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  
  -- Entrega pendente de confirmação
  IF NEW.status = 'DELIVERED_PENDING_CONFIRMATION' AND OLD.status != 'DELIVERED_PENDING_CONFIRMATION' THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.producer_id,
      'Entrega aguardando confirmação',
      'O motorista reportou a entrega. Você tem 72h para confirmar',
      'delivery_confirmation_required',
      jsonb_build_object('freight_id', NEW.id)
    );
  END IF;
  
  -- Frete aceito
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' AND NEW.driver_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.driver_id,
      'Frete aceito!',
      'Sua proposta foi aceita pelo produtor',
      'freight_accepted',
      jsonb_build_object('freight_id', NEW.id)
    );
  END IF;
  
  -- Frete entregue - solicitar avaliações
  IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' THEN
    -- Notificar produtor para avaliar motorista
    IF NEW.driver_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.producer_id,
        'Avalie o motorista',
        'O frete foi entregue. Que tal avaliar o motorista?',
        'rating_pending',
        jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.driver_id)
      );
      
      -- Notificar motorista para avaliar produtor
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
$$;

DROP TRIGGER IF EXISTS trigger_freight_status_notification ON freights;
CREATE TRIGGER trigger_freight_status_notification
AFTER UPDATE ON freights
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_freight_status_change();

-- 9. Notificação de check-in aguardando confirmação
CREATE OR REPLACE FUNCTION notify_checkin_confirmation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  counterpart_id UUID;
  freight_rec RECORD;
BEGIN
  IF NEW.requires_counterpart_confirmation = true AND NEW.counterpart_confirmed_by IS NULL THEN
    SELECT producer_id, driver_id INTO freight_rec
    FROM freights WHERE id = NEW.freight_id;
    
    -- Determinar quem deve confirmar
    IF NEW.user_id = freight_rec.driver_id THEN
      counterpart_id := freight_rec.producer_id;
    ELSE
      counterpart_id := freight_rec.driver_id;
    END IF;
    
    IF counterpart_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        counterpart_id,
        'Check-in aguarda confirmação',
        'Um check-in foi realizado e aguarda sua confirmação',
        'checkin_confirmation_required',
        jsonb_build_object('checkin_id', NEW.id, 'freight_id', NEW.freight_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_checkin_notification ON freight_checkins;
CREATE TRIGGER trigger_checkin_notification
AFTER INSERT ON freight_checkins
FOR EACH ROW
EXECUTE FUNCTION notify_checkin_confirmation();

-- 10. Notificação de pagamento externo proposto
CREATE OR REPLACE FUNCTION notify_external_payment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'proposed' THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.driver_id,
      'Pagamento externo proposto',
      'O produtor propôs um pagamento externo. Confirme o recebimento',
      'external_payment_proposed',
      jsonb_build_object(
        'payment_id', NEW.id, 
        'freight_id', NEW.freight_id, 
        'amount', NEW.amount
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_external_payment_notification ON external_payments;
CREATE TRIGGER trigger_external_payment_notification
AFTER INSERT ON external_payments
FOR EACH ROW
EXECUTE FUNCTION notify_external_payment();