-- Fix urgency type mismatch in RPC functions
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  weight numeric,
  status freight_status,
  urgency text,
  created_at timestamp with time zone,
  producer_id uuid,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  requires_monitoring boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id AS freight_id,
    f.cargo_type,
    f.origin_city,
    f.origin_state,
    f.destination_city,
    f.destination_state,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.weight,
    f.status,
    (f.urgency)::text AS urgency,
    f.created_at,
    f.producer_id,
    f.origin_lat,
    f.origin_lng,
    f.destination_lat,
    f.destination_lng,
    f.requires_monitoring
  FROM freights f
  WHERE f.status IN ('OPEN', 'IN_NEGOTIATION')
    AND (f.driver_id IS NULL OR f.required_trucks > 1)
    AND EXISTS (
      SELECT 1 FROM user_cities uc
      WHERE uc.profile_id = p_driver_id
        AND uc.is_active = true
        AND (
          (uc.city_id = f.origin_city_id AND uc.city_type = 'MOTORISTA_ORIGEM')
          OR (uc.city_id = f.destination_city_id AND uc.city_type = 'MOTORISTA_DESTINO')
        )
    )
  ORDER BY f.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.get_freights_in_radius(uuid, numeric);
CREATE OR REPLACE FUNCTION public.get_freights_in_radius(p_driver_id uuid, radius_km numeric DEFAULT 300)
RETURNS TABLE(
  freight_id uuid,
  cargo_type text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  weight numeric,
  status freight_status,
  urgency text,
  created_at timestamp with time zone,
  producer_id uuid,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  requires_monitoring boolean,
  distance_km numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  driver_lat numeric;
  driver_lng numeric;
BEGIN
  SELECT uc.lat, uc.lng INTO driver_lat, driver_lng
  FROM user_cities uc
  WHERE uc.profile_id = p_driver_id
    AND uc.is_active = true
    AND uc.lat IS NOT NULL
    AND uc.lng IS NOT NULL
  ORDER BY uc.created_at DESC
  LIMIT 1;

  IF driver_lat IS NULL OR driver_lng IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    f.id AS freight_id,
    f.cargo_type,
    f.origin_city,
    f.origin_state,
    f.destination_city,
    f.destination_state,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.weight,
    f.status,
    (f.urgency)::text AS urgency,
    f.created_at,
    f.producer_id,
    f.origin_lat,
    f.origin_lng,
    f.destination_lat,
    f.destination_lng,
    f.requires_monitoring,
    (extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(driver_lng::double precision, driver_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography
    ) / 1000)::numeric AS distance_km
  FROM freights f
  WHERE f.status IN ('OPEN', 'IN_NEGOTIATION')
    AND (f.driver_id IS NULL OR f.required_trucks > 1)
    AND f.origin_lat IS NOT NULL
    AND f.origin_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(driver_lng::double precision, driver_lat::double precision), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(f.origin_lng::double precision, f.origin_lat::double precision), 4326)::extensions.geography,
      (radius_km * 1000)::double precision
    )
  ORDER BY distance_km ASC;
END;
$$;