
CREATE OR REPLACE FUNCTION public.get_participant_freight_count(
  p_user_id UUID,
  p_user_type TEXT DEFAULT 'driver'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count BIGINT := 0;
  v_direct BIGINT := 0;
  v_assignments BIGINT := 0;
  v_services BIGINT := 0;
BEGIN
  IF p_user_type = 'driver' THEN
    -- Direct freights
    SELECT COUNT(*) INTO v_direct
    FROM public.freights
    WHERE driver_id = p_user_id
      AND status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED');

    -- Freight assignments
    SELECT COUNT(*) INTO v_assignments
    FROM public.freight_assignments
    WHERE driver_id = p_user_id
      AND status IN ('DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED');

    -- Service requests
    SELECT COUNT(*) INTO v_services
    FROM public.service_requests
    WHERE provider_id = p_user_id
      AND status IN ('COMPLETED', 'completed');

    v_count := v_direct + v_assignments + v_services;
  ELSE
    -- Producer: all freights with accepted driver
    SELECT COUNT(*) INTO v_count
    FROM public.freights
    WHERE producer_id = p_user_id
      AND status IN ('ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED');
  END IF;

  RETURN v_count;
END;
$$;
