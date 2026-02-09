-- Remove o trigger que bloqueia peso acima de 90 toneladas
DROP TRIGGER IF EXISTS trigger_validate_freight_weight ON public.freights;

-- Recriar a função SEM limite máximo (apenas mínimo de 100kg)
CREATE OR REPLACE FUNCTION public.validate_freight_weight()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Peso mínimo: 100kg (0.1 toneladas)
  IF NEW.weight < 100 THEN
    RAISE EXCEPTION 'Peso mínimo: 100kg (0.1 toneladas)';
  END IF;
  
  -- SEM limite máximo - peso é o TOTAL que o produtor deseja transportar
  -- distribuído entre múltiplos veículos
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER trigger_validate_freight_weight
  BEFORE INSERT OR UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION validate_freight_weight();