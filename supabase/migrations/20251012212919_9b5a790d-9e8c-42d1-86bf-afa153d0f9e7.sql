-- Drop and recreate get_compatible_freights_for_driver without non-existent columns
DROP FUNCTION IF EXISTS public.get_compatible_freights_for_driver(uuid);

CREATE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
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
    fm.distance_m AS match_distance_m
  FROM public.freights f
  JOIN public.freight_matches fm
    ON fm.freight_id = f.id
   AND fm.driver_id = p_driver_id
  WHERE f.status = 'OPEN'::public.freight_status
    AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
  ORDER BY fm.distance_m NULLS LAST, f.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_compatible_freights_for_driver(uuid) TO authenticated;