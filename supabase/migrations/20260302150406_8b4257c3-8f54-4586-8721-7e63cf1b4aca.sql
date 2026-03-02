
-- Fix: backfill pricing_type from freights table when assignment has FIXED/null
UPDATE public.freight_assignment_history fah
SET 
  pricing_type = f.pricing_type,
  price_per_km = COALESCE(f.price_per_km, 0)
FROM public.freights f
WHERE fah.freight_id = f.id
  AND (fah.pricing_type IS NULL OR fah.pricing_type = 'FIXED' OR fah.price_per_km = 0)
  AND f.pricing_type IS NOT NULL;

-- Update trigger to prefer freight's pricing_type over assignment's
CREATE OR REPLACE FUNCTION public.fn_freight_assignment_history_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
BEGIN
  IF NEW.status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED') THEN
    RETURN NEW;
  END IF;

  SELECT origin_city, origin_state, destination_city, destination_state,
         distance_km, weight, cargo_type, required_trucks,
         pricing_type AS freight_pricing_type, price_per_km AS freight_price_per_km
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
    NEW.freight_id, NEW.id, NEW.driver_id, NEW.company_id,
    NEW.status, COALESCE(NEW.delivered_at, now()), COALESCE(NEW.agreed_price, 0),
    COALESCE(v_freight.distance_km, 0),
    CASE
      WHEN COALESCE(v_freight.required_trucks, 1) > 0
      THEN COALESCE(v_freight.weight, 0) / COALESCE(v_freight.required_trucks, 1)
      ELSE COALESCE(v_freight.weight, 0)
    END,
    v_freight.origin_city, v_freight.origin_state,
    v_freight.destination_city, v_freight.destination_state, v_freight.cargo_type,
    COALESCE(v_freight.freight_pricing_type, NEW.pricing_type, 'PER_KM'),
    COALESCE(v_freight.freight_price_per_km, NEW.price_per_km, 0)
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

REVOKE ALL ON FUNCTION public.fn_freight_assignment_history_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_freight_assignment_history_insert() TO authenticated;

-- Normalize company_drivers status to uppercase to prevent future case issues
UPDATE public.company_drivers SET status = UPPER(status) WHERE status != UPPER(status);

-- Add check constraint to prevent lowercase status
ALTER TABLE public.company_drivers DROP CONSTRAINT IF EXISTS company_drivers_status_uppercase;
