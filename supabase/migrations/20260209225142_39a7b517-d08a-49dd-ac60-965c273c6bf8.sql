
DROP FUNCTION IF EXISTS public.get_freights_for_driver(UUID);

CREATE FUNCTION public.get_freights_for_driver(p_driver_id UUID)
RETURNS TABLE (
  id UUID,
  cargo_type TEXT,
  weight NUMERIC,
  origin_address TEXT,
  origin_city TEXT,
  origin_state TEXT,
  destination_address TEXT,
  destination_city TEXT,
  destination_state TEXT,
  price NUMERIC,
  distance_km NUMERIC,
  pickup_date TIMESTAMP WITH TIME ZONE,
  delivery_date TIMESTAMP WITH TIME ZONE,
  urgency TEXT,
  status TEXT,
  service_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  distance_to_origin_km NUMERIC,
  required_trucks INTEGER,
  accepted_trucks INTEGER,
  minimum_antt_price NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id AS id,
    f.cargo_type AS cargo_type,
    f.weight AS weight,
    f.origin_address AS origin_address,
    f.origin_city AS origin_city,
    f.origin_state AS origin_state,
    f.destination_address AS destination_address,
    f.destination_city AS destination_city,
    f.destination_state AS destination_state,
    f.price AS price,
    f.distance_km AS distance_km,
    f.pickup_date AS pickup_date,
    f.delivery_date AS delivery_date,
    f.urgency AS urgency,
    f.status AS status,
    f.service_type AS service_type,
    f.created_at AS created_at,
    NULL::NUMERIC AS distance_to_origin_km,
    f.required_trucks AS required_trucks,
    f.accepted_trucks AS accepted_trucks,
    f.minimum_antt_price AS minimum_antt_price
  FROM freights f
  WHERE f.status = 'OPEN'
    AND EXISTS (
      SELECT 1 FROM user_cities uc
      JOIN cities c ON c.id = uc.city_id
      WHERE uc.user_id = (SELECT p.user_id FROM profiles p WHERE p.id = p_driver_id)
        AND uc.is_active = true
        AND LOWER(f.origin_city) = LOWER(c.name)
        AND LOWER(f.origin_state) = LOWER(c.state)
    )
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
