-- Corrigir trigger notify_service_completion para usar user_id correto
DROP TRIGGER IF EXISTS service_completion_notification ON service_requests;
DROP TRIGGER IF EXISTS trigger_service_completion_notification ON service_requests;
DROP FUNCTION IF EXISTS public.notify_service_completion() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_service_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Recriar trigger
CREATE TRIGGER service_completion_notification
AFTER UPDATE ON service_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_service_completion();