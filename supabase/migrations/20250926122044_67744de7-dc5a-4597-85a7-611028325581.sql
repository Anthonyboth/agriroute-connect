-- Relax weight validation: allow any weight >= 0.1 kg (remove upper bound)
-- Update the freight input validation function accordingly
CREATE OR REPLACE FUNCTION public.validate_freight_input()
RETURNS trigger AS $$
BEGIN
  -- Validate price range
  IF NEW.price IS NOT NULL AND (NEW.price < 1 OR NEW.price > 1000000) THEN
    RAISE EXCEPTION 'Preço deve estar entre R$ 1 e R$ 1.000.000';
  END IF;
  
  -- Validate weight (only lower bound)
  IF NEW.weight IS NOT NULL AND (NEW.weight < 0.1) THEN
    RAISE EXCEPTION 'Peso deve ser maior ou igual a 0.1 kg';
  END IF;
  
  -- Validate addresses (basic length check)
  IF NEW.origin_address IS NOT NULL AND (length(NEW.origin_address) < 5 OR length(NEW.origin_address) > 500) THEN
    RAISE EXCEPTION 'Endereço de origem deve ter entre 5 e 500 caracteres';
  END IF;
  
  IF NEW.destination_address IS NOT NULL AND (length(NEW.destination_address) < 5 OR length(NEW.destination_address) > 500) THEN
    RAISE EXCEPTION 'Endereço de destino deve ter entre 5 e 500 caracteres';
  END IF;
  
  -- Validate dates
  IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de coleta deve ser futura';
  END IF;
  
  IF NEW.delivery_date IS NOT NULL AND NEW.delivery_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de entrega deve ser futura';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and points to the updated function
DROP TRIGGER IF EXISTS freight_input_validation ON public.freights;
CREATE TRIGGER freight_input_validation
  BEFORE INSERT OR UPDATE ON public.freights
  FOR EACH ROW EXECUTE FUNCTION public.validate_freight_input();