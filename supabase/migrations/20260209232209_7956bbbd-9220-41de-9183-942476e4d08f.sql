-- Remove o trigger antigo/duplicado que causa notificações em dobro
DROP TRIGGER IF EXISTS trigger_notify_freight_message ON public.freight_messages;
DROP FUNCTION IF EXISTS public.notify_new_freight_message();

-- Adicionar deduplicação ao trigger que permanece (notify_new_chat_message)
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
  freight_info RECORD;
  notification_title TEXT;
  notification_message TEXT;
  recent_notification BOOLEAN;
BEGIN
  -- Buscar informações do frete
  SELECT 
    f.id,
    f.cargo_type,
    f.producer_id,
    f.driver_id,
    f.company_id,
    p.full_name as sender_name
  INTO freight_info
  FROM freights f
  LEFT JOIN profiles p ON p.id = NEW.sender_id
  WHERE f.id = NEW.freight_id;
  
  IF freight_info IS NULL THEN
    RETURN NEW;
  END IF;
  
  sender_name := COALESCE(freight_info.sender_name, 'Participante');
  
  -- Determinar destinatário
  IF NEW.sender_id = freight_info.producer_id THEN
    recipient_id := freight_info.driver_id;
  ELSIF NEW.sender_id = freight_info.driver_id THEN
    recipient_id := freight_info.producer_id;
  END IF;
  
  IF recipient_id IS NOT NULL THEN
    -- Verificar se já existe notificação recente (últimos 2 minutos) para evitar duplicatas
    SELECT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = recipient_id
      AND type = 'chat_message'
      AND data->>'freight_id' = NEW.freight_id::text
      AND created_at > now() - interval '2 minutes'
    ) INTO recent_notification;

    IF NOT recent_notification THEN
      notification_title := 'Nova mensagem no chat';
      
      IF NEW.message_type = 'TEXT' THEN
        notification_message := sender_name || ': ' || LEFT(NEW.message, 100);
        IF LENGTH(NEW.message) > 100 THEN
          notification_message := notification_message || '...';
        END IF;
      ELSIF NEW.message_type = 'IMAGE' THEN
        notification_message := sender_name || ' enviou uma imagem';
      ELSIF NEW.message_type = 'LOCATION_RESPONSE' THEN
        notification_message := sender_name || ' compartilhou sua localização';
      ELSIF NEW.message_type = 'LOCATION_REQUEST' THEN
        notification_message := sender_name || ' solicitou sua localização';
      ELSIF NEW.message_type = 'FILE' THEN
        notification_message := sender_name || ' enviou um arquivo';
      ELSIF NEW.message_type = 'COUNTER_PROPOSAL' THEN
        notification_message := sender_name || ' enviou uma contra-proposta';
      ELSIF NEW.message_type = 'PROPOSAL' THEN
        notification_message := sender_name || ' enviou uma proposta';
      ELSE
        notification_message := sender_name || ' enviou uma mensagem';
      END IF;
      
      INSERT INTO notifications (user_id, title, message, type, data, read)
      VALUES (
        recipient_id,
        notification_title,
        notification_message,
        'chat_message',
        jsonb_build_object(
          'freight_id', NEW.freight_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id,
          'message_type', NEW.message_type,
          'deep_link', '/dashboard/driver?tab=chat&freight=' || NEW.freight_id
        ),
        false
      );
    END IF;
  END IF;
  
  -- Notificar transportadora se motorista for afiliado
  IF freight_info.company_id IS NOT NULL AND NEW.sender_id != freight_info.producer_id THEN
    DECLARE
      company_profile_id UUID;
    BEGIN
      SELECT profile_id INTO company_profile_id
      FROM transport_companies
      WHERE id = freight_info.company_id;
      
      IF company_profile_id IS NOT NULL AND company_profile_id != NEW.sender_id THEN
        SELECT EXISTS (
          SELECT 1 FROM notifications
          WHERE user_id = company_profile_id
          AND type = 'chat_message'
          AND data->>'freight_id' = NEW.freight_id::text
          AND created_at > now() - interval '2 minutes'
        ) INTO recent_notification;

        IF NOT recent_notification THEN
          INSERT INTO notifications (user_id, title, message, type, data, read)
          VALUES (
            company_profile_id,
            'Nova mensagem no chat do frete',
            sender_name || ' enviou uma mensagem',
            'chat_message',
            jsonb_build_object(
              'freight_id', NEW.freight_id,
              'message_id', NEW.id,
              'sender_id', NEW.sender_id,
              'message_type', NEW.message_type
            ),
            false
          );
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;