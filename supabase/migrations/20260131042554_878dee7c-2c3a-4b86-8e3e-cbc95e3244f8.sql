-- ============================================================================
-- CORREÇÃO: Permitir atualizações em fretes "Em Andamento" independente da data de coleta
-- ============================================================================
-- Problema: O trigger bloqueava motoristas de atualizar status quando pickup_date estava no passado.
-- Fretes em andamento (ACCEPTED, LOADING, LOADED, IN_TRANSIT) NÃO devem ter a data validada.
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_freight_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
  -- Validar data de coleta APENAS para INSERT ou quando frete ainda está OPEN/IN_NEGOTIATION.
  -- Fretes já aceitos e em andamento NÃO devem ter a data validada - o motorista pode
  -- atualizar status a qualquer momento, independente da data.
  -- ============================================================================
  IF TG_OP = 'INSERT' THEN
    -- Para novos fretes, exigir data futura
    IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Data de coleta deve ser futura';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Para UPDATE, permitir data passada em QUALQUER status exceto OPEN/IN_NEGOTIATION
    -- Isso permite motoristas atualizarem status mesmo com data de coleta no passado
    IF NEW.pickup_date IS NOT NULL 
       AND NEW.pickup_date < CURRENT_DATE 
       AND NEW.status IN ('OPEN', 'IN_NEGOTIATION') THEN
      RAISE EXCEPTION 'Data de coleta deve ser futura';
    END IF;
  END IF;
  
  -- CRITICAL FIX: delivery_date validation based on context
  IF NEW.delivery_date IS NOT NULL THEN
    -- On INSERT, always validate as future (creating new freight)
    IF TG_OP = 'INSERT' AND NEW.delivery_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Data de entrega deve ser futura';
    END IF;
    
    -- On UPDATE, only validate if freight is still OPEN or IN_NEGOTIATION
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status IN ('OPEN', 'IN_NEGOTIATION') 
         AND NEW.delivery_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de entrega deve ser futura';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_freight_input IS 
'Valida inputs de fretes. Datas (pickup/delivery) são validadas como futuras APENAS para INSERT 
ou UPDATE de fretes com status OPEN/IN_NEGOTIATION. Fretes já aceitos e em andamento podem 
ter datas passadas para permitir atualizações de status pelo motorista a qualquer momento.';