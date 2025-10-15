-- Corrigir RPCs para retornar freight_id em vez de id (eliminar ambiguidade)

-- 1) get_compatible_freights_for_driver
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status freight_status,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamp with time zone,
  match_distance_m numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    f.id AS freight_id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.origin_city,
    f.origin_state,
    f.destination_city,
    f.destination_state,
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
    0::numeric AS match_distance_m
  FROM freights f
  WHERE f.status = 'OPEN'
    AND (
      f.origin_city_id IN (
        SELECT uc.city_id
        FROM user_cities uc
        WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
          AND uc.is_active = true
          AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
      )
      OR f.destination_city_id IN (
        SELECT uc.city_id
        FROM user_cities uc
        WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
          AND uc.is_active = true
          AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
      )
    )
  ORDER BY f.created_at DESC;
END;
$$;

-- 2) get_freights_in_radius
DROP FUNCTION IF EXISTS public.get_freights_in_radius(uuid, numeric);

CREATE OR REPLACE FUNCTION public.get_freights_in_radius(p_driver_id uuid, radius_km numeric DEFAULT 100)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status freight_status,
  service_type text,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  created_at timestamp with time zone,
  match_distance_m numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  driver_geog extensions.geography;
BEGIN
  -- Obter localização do motorista a partir da primeira cidade ativa
  SELECT extensions.ST_SetSRID(
    extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326
  )::extensions.geography
  INTO driver_geog
  FROM user_cities uc
  JOIN cities c ON c.id = uc.city_id
  WHERE uc.user_id = (SELECT user_id FROM profiles WHERE id = p_driver_id)
    AND uc.is_active = true
    AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
  LIMIT 1;

  IF driver_geog IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id AS freight_id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.origin_city,
    f.origin_state,
    f.destination_city,
    f.destination_state,
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
    extensions.ST_Distance(f.origin_geog, driver_geog)::numeric AS match_distance_m
  FROM freights f
  WHERE f.status = 'OPEN'
    AND extensions.ST_DWithin(f.origin_geog, driver_geog, (radius_km * 1000)::double precision)
  ORDER BY match_distance_m ASC, f.created_at DESC;
END;
$$;