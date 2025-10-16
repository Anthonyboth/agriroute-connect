-- Drop e recriar RPC get_freights_for_driver com urgency como texto
DROP FUNCTION IF EXISTS get_freights_for_driver(uuid);

CREATE FUNCTION get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(
  id uuid,
  producer_id uuid,
  cargo_type text,
  origin_address text,
  origin_city text,
  origin_state text,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text,
  destination_city text,
  destination_state text,
  destination_lat numeric,
  destination_lng numeric,
  price numeric,
  distance_km numeric,
  weight numeric,
  urgent boolean,
  urgency text,
  status freight_status,
  scheduled_date date,
  pickup_date date,
  delivery_date date,
  vehicle_type text,
  required_trucks integer,
  accepted_trucks integer,
  available_slots integer,
  is_partial_booking boolean,
  is_full_booking boolean,
  service_type text,
  created_at timestamp with time zone,
  distance_m numeric,
  match_score numeric
) 
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.producer_id,
    f.cargo_type,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.origin_lat,
    f.origin_lng,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.destination_lat,
    f.destination_lng,
    f.price,
    f.distance_km,
    f.weight,
    f.urgent,
    COALESCE((f.urgency_level)::text, 'LOW') as urgency,
    f.status,
    f.scheduled_date,
    f.pickup_date,
    f.delivery_date,
    f.vehicle_type,
    COALESCE(f.required_trucks, 1) as required_trucks,
    COALESCE(f.accepted_trucks, 0) as accepted_trucks,
    (COALESCE(f.required_trucks, 1) - COALESCE(f.accepted_trucks, 0)) as available_slots,
    (COALESCE(f.accepted_trucks, 0) > 0 AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)) as is_partial_booking,
    f.is_full_booking,
    f.service_type,
    f.created_at,
    fm.distance_m,
    fm.match_score
  FROM freights f
  LEFT JOIN freight_matches fm ON fm.freight_id = f.id AND fm.driver_id = p_driver_id
  WHERE (
    f.status = 'OPEN'::freight_status
    OR (
      f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
    )
  )
  AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
  AND f.service_type IN ('CARGA', 'FRETE_MOTO', 'CARGA_GRANEL', 'CARGA_LIQUIDA')
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments fa
    WHERE fa.freight_id = f.id 
    AND fa.driver_id = p_driver_id
    AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  )
  ORDER BY fm.distance_m NULLS LAST, f.created_at DESC;
END;
$$;

-- Backfill origin_city_id nos fretes onde está NULL
UPDATE freights f
SET origin_city_id = c.id
FROM cities c
WHERE f.origin_city_id IS NULL
  AND f.origin_city IS NOT NULL
  AND f.origin_state IS NOT NULL
  AND LOWER(TRIM(f.origin_city)) = LOWER(TRIM(c.name))
  AND LOWER(TRIM(f.origin_state)) = LOWER(TRIM(c.state));

-- Backfill destination_city_id nos fretes onde está NULL
UPDATE freights f
SET destination_city_id = c.id
FROM cities c
WHERE f.destination_city_id IS NULL
  AND f.destination_city IS NOT NULL
  AND f.destination_state IS NOT NULL
  AND LOWER(TRIM(f.destination_city)) = LOWER(TRIM(c.name))
  AND LOWER(TRIM(f.destination_state)) = LOWER(TRIM(c.state));