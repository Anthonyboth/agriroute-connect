-- Security fix: Add search_path to database functions without it
-- This prevents search_path injection attacks

-- Fix notify_freight_status_change
CREATE OR REPLACE FUNCTION public.notify_freight_status_change()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix notify_proposal_received
CREATE OR REPLACE FUNCTION public.notify_proposal_received()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix notify_new_freight_message
CREATE OR REPLACE FUNCTION public.notify_new_freight_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix notify_new_service_message
CREATE OR REPLACE FUNCTION public.notify_new_service_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix notify_external_payment
CREATE OR REPLACE FUNCTION public.notify_external_payment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix notify_checkin_confirmation
CREATE OR REPLACE FUNCTION public.notify_checkin_confirmation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix notify_service_completion
CREATE OR REPLACE FUNCTION public.notify_service_completion()
RETURNS TRIGGER AS $$
DECLARE
  client_user_id UUID;
  provider_user_id UUID;
BEGIN
  -- Quando serviço é marcado como COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- Buscar user_ids dos profiles
    SELECT user_id INTO client_user_id
    FROM profiles
    WHERE id = NEW.client_id;
    
    SELECT user_id INTO provider_user_id
    FROM profiles
    WHERE id = NEW.provider_id;
    
    -- Notificar cliente para avaliar prestador (apenas se user_id existe)
    IF NEW.provider_id IS NOT NULL AND client_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        client_user_id,
        'Avalie o prestador',
        'O serviço foi concluído. Que tal avaliar o prestador?',
        'service_rating_pending',
        jsonb_build_object('service_request_id', NEW.id, 'rated_user_id', NEW.provider_id)
      );
    END IF;
    
    -- Notificar prestador para avaliar cliente (apenas se user_id existe)
    IF NEW.provider_id IS NOT NULL AND provider_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        provider_user_id,
        'Avalie o cliente',
        'O serviço foi concluído. Que tal avaliar o cliente?',
        'service_rating_pending',
        jsonb_build_object('service_request_id', NEW.id, 'rated_user_id', NEW.client_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comment
COMMENT ON FUNCTION public.notify_freight_status_change() IS 'Security hardened: SET search_path = public to prevent search_path injection';
COMMENT ON FUNCTION public.notify_proposal_received() IS 'Security hardened: SET search_path = public to prevent search_path injection';
COMMENT ON FUNCTION public.notify_new_freight_message() IS 'Security hardened: SET search_path = public to prevent search_path injection';
COMMENT ON FUNCTION public.notify_new_service_message() IS 'Security hardened: SET search_path = public to prevent search_path injection';
COMMENT ON FUNCTION public.notify_external_payment() IS 'Security hardened: SET search_path = public to prevent search_path injection';
COMMENT ON FUNCTION public.notify_checkin_confirmation() IS 'Security hardened: SET search_path = public to prevent search_path injection';
COMMENT ON FUNCTION public.notify_service_completion() IS 'Security hardened: SET search_path = public to prevent search_path injection';