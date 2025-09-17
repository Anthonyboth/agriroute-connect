-- Drop função existente e recriar com nova estrutura
DROP FUNCTION public.get_compatible_freights_for_driver(uuid);

-- Recriar função com novos campos
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
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
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
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
  
  -- Retorna fretes compatíveis que ainda têm vagas
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
    f.required_trucks,
    f.accepted_trucks,
    f.created_at
  FROM freights f
  WHERE 
    f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks  -- Ainda tem vagas
    AND is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
  ORDER BY f.created_at DESC;
END;
$function$