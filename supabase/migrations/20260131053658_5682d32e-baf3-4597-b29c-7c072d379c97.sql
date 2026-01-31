
-- ============================================================================
-- CORREÇÃO: Permitir UPDATE em freights sem validar pickup_date quando 
-- apenas updated_at está sendo modificado (touch para refresh de clients)
-- ============================================================================
-- O problema: Para fretes multi-carreta, o status global permanece OPEN até
-- todas as carretas serem atribuídas. Quando um motorista atualiza seu progresso
-- (LOADING, IN_TRANSIT etc), o RPC faz "UPDATE freights SET updated_at = now()"
-- para forçar refresh nos clients. Este UPDATE dispara o trigger e bloqueia
-- porque pickup_date está no passado e status é OPEN.
--
-- Solução: Se pickup_date NÃO está sendo alterado (OLD.pickup_date = NEW.pickup_date),
-- não validar a data. A validação só deve ocorrer quando pickup_date é modificado.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_freight_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate price range
  IF NEW.price IS NOT NULL AND (NEW.price < 1 OR NEW.price > 1000000) THEN 
    RAISE EXCEPTION 'Preço deve estar entre R$ 1 e R$ 1.000.000'; 
  END IF;
  
  -- Validate minimum weight
  IF NEW.weight IS NOT NULL AND (NEW.weight < 0.1) THEN 
    RAISE EXCEPTION 'Peso deve ser maior ou igual a 0.1 kg'; 
  END IF;
  
  -- Validate origin address length
  IF NEW.origin_address IS NOT NULL AND (length(NEW.origin_address) < 5 OR length(NEW.origin_address) > 500) THEN 
    RAISE EXCEPTION 'Endereço de origem deve ter entre 5 e 500 caracteres'; 
  END IF;
  
  -- Validate destination address length
  IF NEW.destination_address IS NOT NULL AND (length(NEW.destination_address) < 5 OR length(NEW.destination_address) > 500) THEN 
    RAISE EXCEPTION 'Endereço de destino deve ter entre 5 e 500 caracteres'; 
  END IF;
  
  -- ============================================================================
  -- CORREÇÃO CRÍTICA: pickup_date
  -- 1. INSERT: sempre exigir data futura
  -- 2. UPDATE com pickup_date inalterado: NÃO validar (permite touch de updated_at)
  -- 3. UPDATE alterando pickup_date em frete OPEN/IN_NEGOTIATION: exigir data futura
  -- 4. UPDATE em fretes já aceitos (ACCEPTED+): nunca validar pickup_date
  -- ============================================================================
  IF TG_OP = 'INSERT' THEN
    -- Para novos fretes, exigir data futura
    IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Data de coleta deve ser futura';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Se pickup_date não foi alterado, pular validação completamente
    -- Isso permite RPCs que apenas fazem "touch" no frete para refresh de clients
    IF OLD.pickup_date IS NOT DISTINCT FROM NEW.pickup_date THEN
      -- Não validar - pickup_date não mudou
      NULL;
    ELSE
      -- pickup_date foi alterado - validar apenas para fretes OPEN/IN_NEGOTIATION
      IF NEW.pickup_date IS NOT NULL 
         AND NEW.pickup_date < CURRENT_DATE 
         AND NEW.status IN ('OPEN', 'IN_NEGOTIATION') THEN
        RAISE EXCEPTION 'Data de coleta deve ser futura';
      END IF;
    END IF;
  END IF;
  
  -- CRITICAL FIX: delivery_date validation based on context
  IF NEW.delivery_date IS NOT NULL THEN
    -- On INSERT, always validate as future (creating new freight)
    IF TG_OP = 'INSERT' AND NEW.delivery_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Data de entrega deve ser futura';
    END IF;
    
    -- On UPDATE, apply same logic: only validate if delivery_date changed
    IF TG_OP = 'UPDATE' THEN
      IF OLD.delivery_date IS DISTINCT FROM NEW.delivery_date 
         AND NEW.status IN ('OPEN', 'IN_NEGOTIATION') 
         AND NEW.delivery_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de entrega deve ser futura';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.validate_freight_input() IS 
'Validação de input para fretes. CORREÇÃO: Não valida pickup_date quando ela não foi alterada, permitindo RPCs que apenas atualizam updated_at (touch para refresh de multi-truck freights).';
