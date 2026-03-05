
-- Add CANCELLED notification to notify_freight_status_change()
-- When producer cancels a freight, notify all assigned drivers

CREATE OR REPLACE FUNCTION public.notify_freight_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  -- Frete aceito pelo motorista
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE data->>'freight_id' = NEW.id::text 
        AND type = 'freight_accepted'
        AND created_at > now() - interval '5 minutes'
      LIMIT 1
    ) THEN
      IF NEW.producer_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.producer_id,
          'Motorista aceitou o frete',
          'Um motorista aceitou seu frete!',
          'freight_accepted',
          jsonb_build_object('freight_id', NEW.id)
        );
      END IF;
      IF NEW.driver_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM freight_proposals 
          WHERE freight_id = NEW.id 
            AND driver_id = NEW.driver_id 
            AND status = 'ACCEPTED'
          LIMIT 1
        ) THEN
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
    END IF;
  END IF;

  -- ✅ NEW: Frete cancelado pelo produtor — notificar TODOS os motoristas atribuídos
  IF NEW.status = 'CANCELLED' AND OLD.status != 'CANCELLED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE data->>'freight_id' = NEW.id::text 
        AND type = 'freight_cancelled'
        AND created_at > now() - interval '5 minutes'
      LIMIT 1
    ) THEN
      -- Notificar cada motorista que tinha assignment ativo (agora cancelado)
      FOR v_driver_id IN
        SELECT DISTINCT driver_id FROM freight_assignments
        WHERE freight_id = NEW.id
          AND driver_id IS NOT NULL
      LOOP
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          v_driver_id,
          'Frete cancelado pelo produtor',
          'O produtor cancelou o frete que você havia aceitado. Verifique seus fretes disponíveis.',
          'freight_cancelled',
          jsonb_build_object('freight_id', NEW.id)
        );
      END LOOP;
    END IF;
  END IF;
  
  -- Avaliação SOMENTE após COMPLETED (pagamento confirmado)
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    IF NOT EXISTS (
      SELECT 1 FROM notifications 
      WHERE data->>'freight_id' = NEW.id::text 
        AND type = 'rating_pending'
        AND created_at > now() - interval '5 minutes'
      LIMIT 1
    ) THEN
      IF NEW.driver_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.producer_id,
          'Avalie o motorista',
          'O frete foi concluído. Que tal avaliar o motorista?',
          'rating_pending',
          jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.driver_id)
        );
        
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.driver_id,
          'Avalie o produtor',
          'O frete foi concluído. Que tal avaliar o produtor?',
          'rating_pending',
          jsonb_build_object('freight_id', NEW.id, 'rated_user_id', NEW.producer_id)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
