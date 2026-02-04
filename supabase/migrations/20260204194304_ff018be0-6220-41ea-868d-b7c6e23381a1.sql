-- ===============================================
-- FIX: Dropar função antiga para alterar retorno
-- ===============================================
DROP FUNCTION IF EXISTS public.get_freights_for_driver(uuid);

-- ===============================================
-- FIX: Atualizar RPC get_freights_for_driver para usar user_cities
-- Agora filtra por cidades configuradas pelo motorista
-- ===============================================

CREATE OR REPLACE FUNCTION public.get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  destination_address text,
  destination_city text,
  destination_state text,
  price numeric,
  distance_km numeric,
  pickup_date timestamp with time zone,
  delivery_date timestamp with time zone,
  urgency text,
  status text,
  service_type text,
  created_at timestamp with time zone,
  distance_to_origin_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  driver_role TEXT;
  driver_rating NUMERIC;
  driver_is_company BOOLEAN;
  user_type TEXT;
  driver_user_id UUID;
  driver_service_types TEXT[];
BEGIN
  -- Validar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Buscar dados do motorista
  SELECT 
    p.user_id,
    p.role,
    COALESCE(p.rating, 0),
    p.service_types,
    EXISTS(SELECT 1 FROM transport_companies WHERE profile_id = p_driver_id)
  INTO driver_user_id, driver_role, driver_rating, driver_service_types, driver_is_company
  FROM profiles p
  WHERE p.id = p_driver_id;
  
  -- Validar autorização
  IF NOT (
    auth.uid() = driver_user_id
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  
  -- Determinar tipo do motorista
  IF driver_is_company OR driver_role = 'TRANSPORTADORA' THEN
    user_type := 'TRANSPORTADORA';
  ELSE
    user_type := 'AUTONOMO';
  END IF;
  
  -- Retornar fretes filtrados por CIDADE e TIPO DE SERVIÇO
  RETURN QUERY
  SELECT DISTINCT
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.price,
    f.distance_km,
    f.pickup_date,
    f.delivery_date,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.created_at,
    -- Calcular distância até a origem (haversine)
    ROUND(CAST(
      6371 * acos(
        GREATEST(-1, LEAST(1,
          cos(radians(COALESCE(f.origin_lat, c.lat))) *
          cos(radians(c.lat)) *
          cos(radians(c.lng) - radians(COALESCE(f.origin_lng, c.lng))) +
          sin(radians(COALESCE(f.origin_lat, c.lat))) *
          sin(radians(c.lat))
        ))
      ) AS NUMERIC
    ), 2) AS distance_to_origin_km
  FROM freights f
  INNER JOIN user_cities uc 
    ON uc.user_id = driver_user_id
    AND uc.type IN ('MOTORISTA', 'AUTONOMO', 'TRANSPORTADORA')
  INNER JOIN cities c 
    ON c.id = uc.city_id
  WHERE f.status = 'OPEN'
    AND f.driver_id IS NULL
    AND uc.is_active = true
    -- Match por tipo de serviço (normalizado, removendo _URB)
    AND (
      driver_service_types IS NULL
      OR array_length(driver_service_types, 1) = 0
      OR regexp_replace(upper(f.service_type), '_URB$', '') = ANY(
        SELECT regexp_replace(upper(t), '_URB$', '') FROM unnest(driver_service_types) t
      )
      -- Tipos de frete tradicionais sempre visíveis para motoristas
      OR f.service_type IN ('CARGA', 'FRETE_MOTO', 'MUDANCA', 'GUINCHO', 'FRETE_AGRICOLA', 'TRANSPORTE_ANIMAIS')
    )
    -- Match por localização: cidade exata OU dentro do raio
    AND (
      (LOWER(f.origin_city) = LOWER(c.name) AND LOWER(f.origin_state) = LOWER(c.state))
      OR
      (
        f.origin_lat IS NOT NULL AND f.origin_lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        AND 6371 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians(f.origin_lat)) *
            cos(radians(c.lat)) *
            cos(radians(c.lng) - radians(f.origin_lng)) +
            sin(radians(f.origin_lat)) *
            sin(radians(c.lat))
          ))
        ) <= COALESCE(uc.radius_km, 50)
      )
    )
    -- Filtro de visibilidade (rating, tipo)
    AND (
      COALESCE(f.visibility_filter, 'ALL') = 'ALL'
      OR (f.visibility_filter = 'TRANSPORTADORAS' AND user_type = 'TRANSPORTADORA')
      OR (f.visibility_filter = 'AUTONOMOS' AND user_type = 'AUTONOMO')
      OR (f.visibility_filter = 'AVALIACAO_3' AND driver_rating >= 3)
      OR (f.visibility_filter = 'AVALIACAO_4' AND driver_rating >= 4)
    )
  ORDER BY f.created_at DESC;
END;
$function$;