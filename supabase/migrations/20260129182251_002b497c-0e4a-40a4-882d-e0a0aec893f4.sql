-- 4) Helper to log trip progress events (silently; never blocks driver action)
CREATE OR REPLACE FUNCTION public.log_trip_progress_event(
  p_freight_id uuid,
  p_driver_profile_id uuid,
  p_old_status text,
  p_new_status text,
  p_success boolean,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_execution_ms integer DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.trip_progress_audit (
    freight_id,
    driver_profile_id,
    old_status,
    new_status,
    success,
    error_code,
    error_message,
    execution_ms,
    meta
  ) VALUES (
    p_freight_id,
    p_driver_profile_id,
    p_old_status,
    p_new_status,
    COALESCE(p_success, false),
    p_error_code,
    p_error_message,
    p_execution_ms,
    COALESCE(p_meta, '{}'::jsonb)
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the user action due to monitoring
    NULL;
END;
$$;

-- 5) Admin overview of freight trip progress
CREATE OR REPLACE FUNCTION public.get_freight_trip_progress_overview(
  p_only_active boolean DEFAULT true
)
RETURNS TABLE (
  freight_id uuid,
  freight_status text,
  required_trucks integer,
  accepted_trucks integer,
  updated_at timestamptz,
  assignments jsonb,
  last_history_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  RETURN QUERY
  SELECT
    f.id as freight_id,
    f.status::text as freight_status,
    COALESCE(f.required_trucks, 1) as required_trucks,
    COALESCE(f.accepted_trucks, 0) as accepted_trucks,
    f.updated_at,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'assignment_id', fa.id,
            'driver_profile_id', fa.driver_id,
            'status', fa.status::text,
            'updated_at', fa.updated_at
          ) ORDER BY fa.updated_at DESC
        ),
        '[]'::jsonb
      )
      FROM public.freight_assignments fa
      WHERE fa.freight_id = f.id
    ) as assignments,
    (
      SELECT max(h.created_at)
      FROM public.freight_status_history h
      WHERE h.freight_id = f.id
    ) as last_history_at
  FROM public.freights f
  WHERE (
    NOT p_only_active
    OR f.status::text IN ('OPEN','ACCEPTED','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION')
  )
  ORDER BY f.updated_at DESC;
END;
$$;