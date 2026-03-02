
-- Add pricing_type and price_per_km to freight_assignment_history
ALTER TABLE public.freight_assignment_history
  ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'PER_KM',
  ADD COLUMN IF NOT EXISTS price_per_km NUMERIC DEFAULT 0;

-- Backfill from freight_assignments
UPDATE public.freight_assignment_history fah
SET 
  pricing_type = fa.pricing_type,
  price_per_km = COALESCE(fa.price_per_km, 0)
FROM public.freight_assignments fa
WHERE fah.assignment_id = fa.id;

-- Update trigger function to include pricing_type and price_per_km
CREATE OR REPLACE FUNCTION public.fn_freight_assignment_history_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
BEGIN
  -- Only trigger for terminal statuses
  IF NEW.status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED') THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do frete pai
  SELECT origin_city, origin_state, destination_city, destination_state,
         distance_km, weight, cargo_type, required_trucks
  INTO v_freight
  FROM public.freights
  WHERE id = NEW.freight_id;

  INSERT INTO public.freight_assignment_history (
    freight_id, assignment_id, driver_id, company_id,
    status_final, completed_at, agreed_price,
    distance_km, weight_per_truck,
    origin_city, origin_state, destination_city, destination_state, cargo_type,
    pricing_type, price_per_km
  ) VALUES (
    NEW.freight_id,
    NEW.id,
    NEW.driver_id,
    NEW.company_id,
    NEW.status,
    COALESCE(NEW.delivered_at, now()),
    COALESCE(NEW.agreed_price, 0),
    COALESCE(v_freight.distance_km, 0),
    CASE
      WHEN COALESCE(v_freight.required_trucks, 1) > 0
      THEN COALESCE(v_freight.weight, 0) / COALESCE(v_freight.required_trucks, 1)
      ELSE COALESCE(v_freight.weight, 0)
    END,
    v_freight.origin_city,
    v_freight.origin_state,
    v_freight.destination_city,
    v_freight.destination_state,
    v_freight.cargo_type,
    COALESCE(NEW.pricing_type, 'PER_KM'),
    COALESCE(NEW.price_per_km, 0)
  )
  ON CONFLICT (assignment_id) DO UPDATE SET
    status_final = EXCLUDED.status_final,
    completed_at = EXCLUDED.completed_at,
    agreed_price = EXCLUDED.agreed_price,
    pricing_type = EXCLUDED.pricing_type,
    price_per_km = EXCLUDED.price_per_km;

  RETURN NEW;
END;
$$;

-- Revoke from public, grant to authenticated
REVOKE ALL ON FUNCTION public.fn_freight_assignment_history_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_freight_assignment_history_insert() TO authenticated;
