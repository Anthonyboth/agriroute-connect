
-- Corrigir notify_external_payment para NÃO disparar notificação ao motorista
-- quando o pagamento é auto-criado (status 'proposed').
-- O motorista só deve ser notificado quando o produtor confirma o pagamento (paid_by_producer).

CREATE OR REPLACE FUNCTION public.notify_external_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Notificar motorista APENAS quando o produtor confirma pagamento (paid_by_producer)
  -- NÃO notificar na criação automática (proposed) pois o produtor ainda não fez nada
  IF TG_OP = 'UPDATE' AND NEW.status = 'paid_by_producer' AND OLD.status = 'proposed' THEN
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES (
      NEW.driver_id,
      'Pagamento confirmado pelo produtor',
      'O produtor confirmou o pagamento. Verifique o recebimento e confirme.',
      'external_payment_paid',
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

-- Atualizar trigger para disparar em INSERT E UPDATE (antes era só INSERT)
DROP TRIGGER IF EXISTS trigger_external_payment_notification ON external_payments;
CREATE TRIGGER trigger_external_payment_notification
AFTER INSERT OR UPDATE ON external_payments
FOR EACH ROW
EXECUTE FUNCTION notify_external_payment();
