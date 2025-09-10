-- Corrigir o search_path da função is_service_compatible
CREATE OR REPLACE FUNCTION public.is_service_compatible(
  driver_service_types text[],
  freight_service_type text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se não há tipos definidos para o motorista, aceita todos
  IF driver_service_types IS NULL OR array_length(driver_service_types, 1) IS NULL THEN
    RETURN true;
  END IF;
  
  -- Se o frete não tem tipo definido, considera como CARGA
  IF freight_service_type IS NULL THEN
    freight_service_type := 'CARGA';
  END IF;
  
  -- Verifica se o tipo do frete está nos tipos aceitos pelo motorista
  RETURN freight_service_type = ANY(driver_service_types);
END;
$$;