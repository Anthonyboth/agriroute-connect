-- Auto-confirmar entregas reportadas quando o frete tiver sido solicitado sem cadastro (producer_id IS NULL)
-- Fretes sem produtor registrado não precisam aguardar confirmação manual

-- 1) Criar função que auto-confirma entregas de fretes sem produtor
CREATE OR REPLACE FUNCTION public.auto_confirm_unregistered_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Quando frete SEM produtor vai para DELIVERED_PENDING_CONFIRMATION
  -- confirmar automaticamente para DELIVERED
  IF NEW.status = 'DELIVERED_PENDING_CONFIRMATION' 
     AND OLD.status != 'DELIVERED_PENDING_CONFIRMATION'
     AND NEW.producer_id IS NULL THEN
    
    -- Atualizar para DELIVERED imediatamente
    NEW.status := 'DELIVERED';
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_confirmed_at', now(),
      'auto_confirmed_reason', 'Auto-confirmado: solicitante sem cadastro (entrega reportada)'
    );
    
    -- Inserir no histórico
    INSERT INTO public.freight_status_history (freight_id, status, notes, changed_by)
    VALUES (
      NEW.id,
      'DELIVERED',
      'Auto-confirmado: solicitante sem cadastro (entrega reportada)',
      NEW.driver_id
    );
    
    -- Atualizar assignments do motorista
    UPDATE public.freight_assignments
    SET 
      status = 'DELIVERED',
      delivered_at = now()
    WHERE freight_id = NEW.id
      AND status != 'DELIVERED';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2) Criar trigger BEFORE UPDATE para executar a auto-confirmação
DROP TRIGGER IF EXISTS trigger_auto_confirm_unregistered_delivery ON public.freights;

CREATE TRIGGER trigger_auto_confirm_unregistered_delivery
  BEFORE UPDATE ON public.freights
  FOR EACH ROW
  WHEN (NEW.status = 'DELIVERED_PENDING_CONFIRMATION' 
        AND OLD.status IS DISTINCT FROM 'DELIVERED_PENDING_CONFIRMATION')
  EXECUTE FUNCTION public.auto_confirm_unregistered_delivery();

-- 3) Ajustar função prevent_regressive_freight_status_changes para permitir transição automática
CREATE OR REPLACE FUNCTION public.prevent_regressive_freight_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Permitir transição automática para fretes sem produtor
  IF NEW.producer_id IS NULL 
     AND OLD.status = 'DELIVERED_PENDING_CONFIRMATION' 
     AND NEW.status = 'DELIVERED' THEN
    RETURN NEW;
  END IF;

  -- IMPEDIR que frete vá para status final se ainda tem vagas
  IF NEW.status IN ('DELIVERED', 'CANCELLED')
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status = 'OPEN' THEN
    RAISE EXCEPTION 'Não é possível mudar status do frete para % pois ainda há % vagas disponíveis (% de % carretas aceitas)',
      NEW.status, (NEW.required_trucks - NEW.accepted_trucks), NEW.accepted_trucks, NEW.required_trucks;
  END IF;
  
  RETURN NEW;
END;
$function$;