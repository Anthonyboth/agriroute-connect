-- Corrigir search_path da função validate_freight_weight para segurança
CREATE OR REPLACE FUNCTION validate_freight_weight()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar peso mínimo
  IF NEW.weight < 100 THEN
    RAISE EXCEPTION 'Peso mínimo: 100kg (0.1 toneladas)';
  END IF;
  
  -- Validar peso máximo  
  IF NEW.weight > 50000 THEN
    RAISE EXCEPTION 'Peso máximo: 50.000kg (50 toneladas)';
  END IF;
  
  -- Warning para valores muito altos
  IF NEW.weight > 45000 THEN
    RAISE WARNING 'Peso muito alto: % kg. Confirme se está correto.', NEW.weight;
  END IF;
  
  RETURN NEW;
END;
$$;