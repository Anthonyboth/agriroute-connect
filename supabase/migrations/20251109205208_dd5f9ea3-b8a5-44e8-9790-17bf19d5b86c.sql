-- Fix delivery_date validation to allow delivery status updates
-- This migration fixes the issue where drivers cannot mark freight as delivered
-- because the trigger incorrectly validates delivery_date as future even during delivery updates

CREATE OR REPLACE FUNCTION validate_freight_input()
RETURNS TRIGGER AS $$
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
  
  -- Validate pickup date (always future)
  IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE THEN 
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
$$ LANGUAGE plpgsql;

-- Add comment explaining the fix
COMMENT ON FUNCTION validate_freight_input() IS 'Validates freight input data. Allows past delivery_date when freight is being marked as delivered/completed. Fixes issue preventing delivery status updates.';