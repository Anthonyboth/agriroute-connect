-- Corrigir normalização de FRETE_MOTO para MOTO na função get_compatible_freights_for_driver
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  freight_id uuid,
  cargo_type text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  distance_km numeric,
  minimum_antt_price numeric,
  origin_address text,
  destination_address text,
  price numeric,
  price_per_km numeric,
  required_trucks integer,
  service_type text,
  status freight_status,
  urgency text,
  weight numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_service_types TEXT[];
BEGIN
  -- Buscar tipos de serviço do motorista
  SELECT COALESCE(service_types, ARRAY[]::TEXT[])
  INTO v_service_types
  FROM profiles
  WHERE id = p_driver_id;

  -- Retornar fretes compatíveis com normalização correta de FRETE_MOTO
  RETURN QUERY
  WITH all_matches AS (
    SELECT DISTINCT
      fm.freight_id,
      fm.distance_m AS match_distance_m
    FROM freight_matches fm
    WHERE fm.driver_id = p_driver_id
  )
  SELECT
    f.id AS freight_id,
    COALESCE(f.cargo_type, ''::text) AS cargo_type,
    COALESCE(f.origin_city, ''::text) AS origin_city,
    COALESCE(f.origin_state, ''::text) AS origin_state,
    COALESCE(f.destination_city, ''::text) AS destination_city,
    COALESCE(f.destination_state, ''::text) AS destination_state,
    f.pickup_date,
    f.delivery_date,
    COALESCE(f.distance_km, 0)::numeric AS distance_km,
    COALESCE(f.minimum_antt_price, 0)::numeric AS minimum_antt_price,
    COALESCE(f.origin_address, ''::text) AS origin_address,
    COALESCE(f.destination_address, ''::text) AS destination_address,
    COALESCE(f.price, 0)::numeric AS price,
    COALESCE(f.price_per_km, 0)::numeric AS price_per_km,
    COALESCE(f.required_trucks, 1) AS required_trucks,
    -- Normalizar service_type - FRETE_MOTO agora retorna MOTO
    CASE 
      WHEN f.service_type IS NULL THEN 'CARGA'
      WHEN f.service_type::text IN ('CARGA_FREIGHT') THEN 'CARGA'
      WHEN f.service_type::text IN ('GUINCHO_FREIGHT') THEN 'GUINCHO'
      WHEN f.service_type::text IN ('FRETE_MOTO') THEN 'MOTO'
      ELSE f.service_type::text
    END AS service_type,
    f.status,
    COALESCE(f.urgency::text, 'LOW') AS urgency,
    COALESCE(f.weight, 0)::numeric AS weight
  FROM freights f
  JOIN all_matches ON all_matches.freight_id = f.id
  WHERE f.status = 'OPEN'
    AND COALESCE(f.accepted_trucks,0) < COALESCE(f.required_trucks,1)
    AND (
      v_service_types IS NULL 
      OR array_length(v_service_types,1) IS NULL
      OR CASE 
           WHEN f.service_type IS NULL THEN 'CARGA'
           WHEN f.service_type::text IN ('CARGA_FREIGHT') THEN 'CARGA'
           WHEN f.service_type::text IN ('GUINCHO_FREIGHT') THEN 'GUINCHO'
           WHEN f.service_type::text IN ('FRETE_MOTO') THEN 'MOTO'
           ELSE f.service_type::text
         END = ANY(v_service_types)
    )
  ORDER BY all_matches.match_distance_m NULLS LAST, f.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_compatible_freights_for_driver(uuid) TO authenticated;