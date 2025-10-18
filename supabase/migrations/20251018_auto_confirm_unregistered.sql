-- 2025-10-18: Auto-confirmar entregas reportadas quando o frete tiver sido solicitado sem cadastro (producer_id IS NULL).
-- Também atualiza a função prevent_regressive_freight_status_changes para permitir a transição automática para COMPLETED.

-- 1) Atualiza a função que previne mudanças regressivas para permitir COMPLETED
CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Permitir transição para COMPLETED (usada pelo processo automático)
  IF OLD.status = 'DELIVERED_PENDING_CONFIRMATION'
     AND NEW.status NOT IN ('DELIVERED','DELIVERED_PENDING_CONFIRMATION','COMPLETED') THEN
    RAISE EXCEPTION 'Transição de status inválida após entrega reportada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_regressive_freight_status_changes ON public.freights;
CREATE TRIGGER trg_prevent_regressive_freight_status_changes
BEFORE UPDATE ON public.freights
FOR EACH ROW
EXECUTE FUNCTION public.prevent_regressive_freight_status_changes();

-- 2) Função/trigger para auto-confirmar frete quando produtor for NULL (Solicitante sem cadastro)
--    Executa AFTER UPDATE: quando status virar DELIVERED_PENDING_CONFIRMATION e producer_id IS NULL,
--    atualiza o frete para COMPLETED, cria entrada no freight_status_history e atualiza assignments.
CREATE OR REPLACE FUNCTION public.auto_confirm_unregistered_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Só age quando a transição acabou de ocorrer para DELIVERED_PENDING_CONFIRMATION
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'DELIVERED_PENDING_CONFIRMATION'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND (NEW.producer_id IS NULL) THEN

    -- Marcar metadata de auto-confirmacao e setar status para COMPLETED
    UPDATE public.freights
    SET status = 'COMPLETED',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'auto_confirmed_at', now(),
          'auto_confirmed_reason', 'Solicitante sem cadastro'
        ),
        updated_at = now()
    WHERE id = NEW.id;

    -- Inserir histórico de status COMPLETED
    INSERT INTO public.freight_status_history (
      freight_id, status, changed_by, notes, created_at
    ) VALUES (
      NEW.id,
      'COMPLETED',
      NULL,
      'Auto-confirmed: solicitante sem cadastro (entrega reportada)',
      now()
    );

    -- Atualizar assignment(s) do motorista (marcar como entregue)
    UPDATE public.freight_assignments
    SET status = 'COMPLETED',
        delivered_at = now(),
        delivery_date = now()::date,
        updated_at = now()
    WHERE freight_id = NEW.id
      AND status IN ('ACCEPTED','LOADING','LOADED','IN_TRANSIT');

    -- (Opcional) Criar notificação caso queira avisar o produtor cadastrado — aqui não aplicamos porque producer_id IS NULL

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_confirm_unregistered_delivery ON public.freights;
CREATE TRIGGER trigger_auto_confirm_unregistered_delivery
AFTER UPDATE ON public.freights
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_unregistered_delivery();
