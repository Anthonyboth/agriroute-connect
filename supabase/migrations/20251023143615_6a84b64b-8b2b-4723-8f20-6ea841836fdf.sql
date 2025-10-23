-- Fix get_freights_for_driver to include city columns and expand service types
DROP FUNCTION IF EXISTS public.get_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  origin_city text,
  origin_state text,
  destination_city text,
  destination_state text,
  origin_city_id uuid,
  destination_city_id uuid,
  pickup_date timestamptz,
  delivery_date timestamptz,
  price numeric,
  urgency text,
  status freight_status,
  service_type text,
  producer_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id, 
    f.cargo_type, 
    f.weight,
    f.origin_address, 
    f.destination_address,
    f.origin_city, 
    f.origin_state,
    f.destination_city, 
    f.destination_state,
    f.origin_city_id, 
    f.destination_city_id,
    f.pickup_date, 
    f.delivery_date, 
    f.price,
    f.urgency::text, 
    f.status, 
    f.service_type,
    f.producer_id, 
    f.created_at
  FROM public.freights f
  WHERE f.status = 'OPEN'
    AND f.driver_id IS NULL
    AND COALESCE(f.service_type, 'CARGA') IN (
      'FRETE_MOTO',
      'CARGA',
      'CARGA_GERAL',
      'CARGA_AGRICOLA',
      'CARGA_GRANEL',
      'CARGA_LIQUIDA',
      'GUINCHO',
      'MUDANCA',
      'TRANSPORTE_ANIMAIS',
      'TRANSPORTE_MAQUINARIO'
    )
  ORDER BY f.created_at DESC
  LIMIT 200;
END;
$$;