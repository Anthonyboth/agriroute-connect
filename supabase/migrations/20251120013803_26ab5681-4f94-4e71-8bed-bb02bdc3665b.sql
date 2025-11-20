-- Atualizar função de validação de peso para permitir 90 toneladas
CREATE OR REPLACE FUNCTION public.validate_freight_weight()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Peso mínimo: 100kg (0.1 toneladas)
  IF NEW.weight < 100 THEN
    RAISE EXCEPTION 'Peso mínimo: 100kg (0.1 toneladas)';
  END IF;
  
  -- Peso máximo atualizado: 90.000kg (90 toneladas) para alinhar com frontend
  IF NEW.weight > 90000 THEN
    RAISE EXCEPTION 'Peso máximo: 90.000kg (90 toneladas)';
  END IF;
  
  -- Warning para pesos muito altos
  IF NEW.weight > 80000 THEN
    RAISE WARNING 'Peso muito alto: % kg. Confirme se está correto.', NEW.weight;
  END IF;
  
  RETURN NEW;
END;
$function$;