-- Fix: Correct freight status logic for multi-truck freights
-- Ensures status stays OPEN when partially filled (accepted_trucks < required_trucks)
-- Only changes to ACCEPTED when fully booked

BEGIN;

CREATE OR REPLACE FUNCTION public.recalc_freight_accepted_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_freight_id UUID;
  actual_count INTEGER;
  required_count INTEGER;
  current_status freight_status;
  unique_drivers UUID[];
  new_status freight_status;
BEGIN
  -- Determine which freight_id to process
  IF TG_OP = 'DELETE' THEN
    target_freight_id := OLD.freight_id;
  ELSE
    target_freight_id := NEW.freight_id;
  END IF;

  -- Count accepted assignments (not cancelled/rejected)
  SELECT COUNT(*), array_agg(DISTINCT driver_id)
  INTO actual_count, unique_drivers
  FROM freight_assignments
  WHERE freight_id = target_freight_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  -- Fetch freight data
  SELECT required_trucks, status
  INTO required_count, current_status
  FROM freights
  WHERE id = target_freight_id;

  -- Determine new status based on actual counts
  new_status := current_status; -- default: keep current status

  -- Skip if freight is in a terminal status
  IF current_status IN ('DELIVERED', 'CANCELLED', 'COMPLETED') THEN
    new_status := current_status;
  -- FULLY BOOKED: all trucks assigned -> ACCEPTED
  ELSIF COALESCE(actual_count, 0) >= COALESCE(required_count, 1) THEN
    new_status := 'ACCEPTED'::freight_status;
  -- PARTIALLY FILLED: some trucks assigned but not all -> keep as OPEN
  ELSIF COALESCE(actual_count, 0) > 0 AND COALESCE(actual_count, 0) < COALESCE(required_count, 1) THEN
    -- Force back to OPEN if it was accidentally changed
    IF current_status NOT IN ('OPEN', 'IN_NEGOTIATION') THEN
      new_status := 'OPEN'::freight_status;
    END IF;
  -- NO ASSIGNMENTS: status stays as is (could be OPEN or IN_NEGOTIATION)
  END IF;

  -- Update freight with corrected values
  UPDATE freights
  SET 
    accepted_trucks = COALESCE(actual_count, 0),
    drivers_assigned = COALESCE(unique_drivers, ARRAY[]::UUID[]),
    is_full_booking = (COALESCE(actual_count, 0) >= COALESCE(required_count, 1)),
    status = new_status,
    -- For multi-truck freights, DON'T set driver_id on single assignment
    driver_id = CASE
      WHEN COALESCE(required_count, 1) = 1 AND array_length(unique_drivers, 1) = 1 THEN unique_drivers[1]
      WHEN COALESCE(required_count, 1) > 1 THEN NULL -- Multi-truck: don't set single driver_id
      ELSE driver_id -- keep existing
    END,
    updated_at = now()
  WHERE id = target_freight_id;

  -- Log operation
  RAISE LOG 'recalc_freight_accepted_trucks: freight_id=%, actual=%, required=%, old_status=%, new_status=%',
    target_freight_id, actual_count, required_count, current_status, new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Immediately fix the broken freight
UPDATE freights
SET 
  status = 'OPEN',
  driver_id = NULL
WHERE id = 'cdc92bc9-8d81-4960-b27f-2b14c178ce0a'
  AND required_trucks > 1
  AND accepted_trucks < required_trucks;

COMMIT;
