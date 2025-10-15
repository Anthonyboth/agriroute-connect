-- Atualizar get_compatible_freights_for_driver para considerar user_cities quando não houver freight_matches
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
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
  status public.freight_status,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamptz,
  price_per_km numeric,
  pricing_type text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  match_distance_m numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_service_types text[];
BEGIN
  -- Obter user_id e service_types do profile
  SELECT user_id, service_types 
  INTO v_user_id, v_service_types
  FROM profiles 
  WHERE id = p_driver_id;

  -- Retornar fretes via freight_matches (prioridade)
  -- UNION com fretes compatíveis via user_cities
  RETURN QUERY
  SELECT DISTINCT
    f.id AS freight_id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency,
    f.status,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at,
    f.price_per_km,
    CASE WHEN f.price_per_km IS NOT NULL THEN 'PER_KM' ELSE 'FIXED' END AS pricing_type,
    f.origin_city,
    f.origin_state,
    f.destination_city,
    f.destination_state,
    COALESCE(fm.distance_m, 0::numeric) AS match_distance_m
  FROM freights f
  LEFT JOIN freight_matches fm ON fm.freight_id = f.id AND fm.driver_id = p_driver_id
  WHERE f.status = 'OPEN'::freight_status
    AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
    AND (
      -- Critério 1: Existe match em freight_matches
      fm.id IS NOT NULL
      OR
      -- Critério 2: Existe user_cities compatível
      EXISTS (
        SELECT 1 
        FROM user_cities uc
        JOIN cities c ON uc.city_id = c.id
        WHERE uc.user_id = v_user_id
          AND uc.is_active = true
          AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
          AND (
            -- Match por city_id quando disponível
            (f.origin_city_id IS NOT NULL AND uc.city_id = f.origin_city_id)
            OR
            (f.destination_city_id IS NOT NULL AND uc.city_id = f.destination_city_id)
            OR
            -- Fallback por nome/estado (normalizado)
            (
              LOWER(TRIM(c.name)) = LOWER(TRIM(f.origin_city)) 
              AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.origin_state))
            )
            OR
            (
              LOWER(TRIM(c.name)) = LOWER(TRIM(f.destination_city)) 
              AND LOWER(TRIM(c.state)) = LOWER(TRIM(f.destination_state))
            )
          )
      )
    )
    -- Filtrar por service_types do motorista (normalização)
    AND (
      v_service_types IS NULL 
      OR array_length(v_service_types, 1) IS NULL
      OR f.service_type = ANY(v_service_types)
      -- Normalizar variações de tipo
      OR (f.service_type = 'CARGA_FREIGHT' AND 'CARGA' = ANY(v_service_types))
      OR (f.service_type = 'GUINCHO_FREIGHT' AND 'GUINCHO' = ANY(v_service_types))
      OR (f.service_type = 'FRETE_MOTO' AND 'GUINCHO' = ANY(v_service_types))
    )
  ORDER BY match_distance_m NULLS LAST, created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compatible_freights_for_driver(uuid) TO authenticated;