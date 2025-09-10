-- Adicionar campo para tipos de serviço que o motorista oferece
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS service_types text[] DEFAULT ARRAY['CARGA'];

-- Atualizar motoristas existentes para terem o tipo CARGA por padrão
UPDATE profiles 
SET service_types = ARRAY['CARGA'] 
WHERE role = 'MOTORISTA' AND service_types IS NULL;

-- Função para verificar compatibilidade de serviços
CREATE OR REPLACE FUNCTION public.is_service_compatible(
  driver_service_types text[],
  freight_service_type text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
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

-- Função para obter fretes compatíveis para um motorista
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(
  p_driver_id uuid
)
RETURNS TABLE (
  freight_id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status text,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  driver_services text[];
BEGIN
  -- Buscar os tipos de serviço do motorista
  SELECT service_types INTO driver_services
  FROM profiles 
  WHERE id = p_driver_id AND role = 'MOTORISTA';
  
  -- Se não encontrou o motorista, retorna vazio
  IF driver_services IS NULL THEN
    RETURN;
  END IF;
  
  -- Retorna fretes compatíveis
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.created_at
  FROM freights f
  WHERE 
    f.status = 'OPEN'
    AND is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
  ORDER BY f.created_at DESC;
END;
$$;