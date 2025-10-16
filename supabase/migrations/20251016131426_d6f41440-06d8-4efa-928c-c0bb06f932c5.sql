-- Corrigir função get_freights_for_driver para usar coluna correta de urgency
DROP FUNCTION IF EXISTS get_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  freight_id uuid,
  cargo_type text,
  service_type text,
  weight numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status freight_status,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  available_slots integer,
  is_partial_booking boolean,
  producer_id uuid,
  producer_name text,
  producer_phone text,
  match_type text,
  distance_m numeric,
  match_score numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id AS freight_id,
    f.cargo_type,
    f.service_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.origin_lat,
    f.origin_lng,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.pickup_date,
    f.delivery_date,
    f.price,
    COALESCE(f.urgency, 'LOW') AS urgency,
    f.status,
    f.distance_km,
    f.minimum_antt_price,
    COALESCE(f.required_trucks, 1) AS required_trucks,
    COALESCE(f.accepted_trucks, 0) AS accepted_trucks,
    (COALESCE(f.required_trucks, 1) - COALESCE(f.accepted_trucks, 0)) AS available_slots,
    (COALESCE(f.accepted_trucks, 0) > 0 AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)) AS is_partial_booking,
    f.producer_id,
    p.full_name AS producer_name,
    p.contact_phone AS producer_phone,
    fm.match_type,
    fm.distance_m,
    fm.match_score,
    f.created_at
  FROM freights f
  LEFT JOIN freight_matches fm ON fm.freight_id = f.id AND fm.driver_id = p_driver_id
  LEFT JOIN profiles p ON p.id = f.producer_id
  WHERE (
    f.status = 'OPEN'::freight_status
    OR (
      f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
    )
  )
  AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments fa
    WHERE fa.freight_id = f.id 
    AND fa.driver_id = p_driver_id
    AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  )
  ORDER BY fm.distance_m NULLS LAST, f.created_at DESC;
END;
$$;