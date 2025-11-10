-- ============================================================================
-- CORREÇÃO DO TRIGGER DE VALIDAÇÃO PARA PERMITIR CANCELAMENTO AUTOMÁTICO
-- ============================================================================
-- Permite datas de coleta passadas quando o status for CANCELLED
-- ============================================================================

-- Recriar a função de validação com exceção para CANCELLED
CREATE OR REPLACE FUNCTION validate_freight_input()
RETURNS TRIGGER
LANGUAGE plpgsql
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
  
  -- Validate pickup date (future, EXCEPT when CANCELLED)
  IF NEW.pickup_date IS NOT NULL 
     AND NEW.pickup_date < CURRENT_DATE 
     AND NEW.status NOT IN ('CANCELLED', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED') THEN 
    RAISE EXCEPTION 'Data de coleta deve ser futura'; 
  END IF;
  
  -- CRITICAL FIX: delivery_date validation based on context
  IF NEW.delivery_date IS NOT NULL THEN
    -- On INSERT, always validate as future (creating new freight)
    IF TG_OP = 'INSERT' AND NEW.delivery_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'Data de entrega deve ser futura';
    END IF;
    
    -- On UPDATE, only validate if NOT a delivery status
    -- Allow past dates when marking as delivered/completed
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status NOT IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED') 
         AND NEW.delivery_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de entrega deve ser futura';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_freight_input IS 
'Valida inputs de fretes, permitindo datas passadas para status CANCELLED, DELIVERED e COMPLETED';

-- Executar a função de cancelamento automático novamente
SELECT auto_cancel_overdue_freights();