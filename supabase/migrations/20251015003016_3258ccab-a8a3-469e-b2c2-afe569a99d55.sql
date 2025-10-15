-- Função para notificar quando serviço é completado
CREATE OR REPLACE FUNCTION notify_service_completion()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Quando serviço é marcado como COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- Notificar cliente para avaliar prestador
    IF NEW.provider_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.client_id,
        'Avalie o prestador',
        'O serviço foi concluído. Que tal avaliar o prestador?',
        'service_rating_pending',
        jsonb_build_object('service_request_id', NEW.id, 'rated_user_id', NEW.provider_id)
      );
      
      -- Notificar prestador para avaliar cliente
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.provider_id,
        'Avalie o cliente',
        'O serviço foi concluído. Que tal avaliar o cliente?',
        'service_rating_pending',
        jsonb_build_object('service_request_id', NEW.id, 'rated_user_id', NEW.client_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_service_completion_notification ON service_requests;
CREATE TRIGGER trigger_service_completion_notification
AFTER UPDATE ON service_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_service_completion();