
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
    f.urgency::TEXT,
    f.status::TEXT,
    f.service_type,
    f.created_at,
    NULL::NUMERIC,
    f.required_trucks,
    f.accepted_trucks,
    f.minimum_antt_price
  FROM freights f
  WHERE f.status = 'OPEN'::freight_status
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
