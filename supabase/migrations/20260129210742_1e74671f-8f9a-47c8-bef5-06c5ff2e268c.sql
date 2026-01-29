-- Fix Producer Reports for multi-truck freights: compute financials and rankings per-assignment (per carreta)

CREATE OR REPLACE FUNCTION public.get_producer_report_summary(
  p_profile_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Validate that the requested profile belongs to the authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH freight_units AS (
    SELECT
      fa.id AS assignment_id,
      fa.freight_id,
      fa.driver_id,
      fa.status AS assignment_status,
      COALESCE(
        fa.agreed_price,
        (f.price / GREATEST(COALESCE(NULLIF(f.required_trucks, 0), 1), 1))
      )::numeric AS unit_price,
      f.distance_km,
      f.cargo_type,
      f.origin_address,
      f.destination_address,
      COALESCE(fa.accepted_at, fa.created_at) AS unit_date,
      fa.pickup_date,
      COALESCE(fa.delivered_at, fa.delivery_date, f.delivery_date) AS delivered_ts
    FROM public.freight_assignments fa
    JOIN public.freights f ON f.id = fa.freight_id
    WHERE f.producer_id = p_profile_id
      AND COALESCE(fa.accepted_at, fa.created_at) >= p_start_at
      AND COALESCE(fa.accepted_at, fa.created_at) <= p_end_at
  )
  SELECT json_build_object(
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (
          WHERE assignment_status IN ('ACCEPTED','LOADING','LOADED','DELIVERED_PENDING_CONFIRMATION')
        ),
        'in_transit', COUNT(*) FILTER (WHERE assignment_status = 'IN_TRANSIT'),
        'completed', COUNT(*) FILTER (WHERE assignment_status IN ('DELIVERED','COMPLETED')),
        'cancelled', COUNT(*) FILTER (WHERE assignment_status = 'CANCELLED'),
        -- Producer financials must reflect contracted units (carretas), not total freight.price
        'total_spent', COALESCE(SUM(unit_price) FILTER (WHERE assignment_status <> 'CANCELLED'), 0),
        'avg_price', COALESCE(AVG(unit_price) FILTER (WHERE assignment_status <> 'CANCELLED'), 0),
        'avg_distance_km', COALESCE(AVG(distance_km) FILTER (WHERE assignment_status <> 'CANCELLED'), 0),
        'total_distance_km', COALESCE(SUM(distance_km) FILTER (WHERE assignment_status <> 'CANCELLED'), 0)
      )
      FROM freight_units
    ),
    'services', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'total_spent', COALESCE(SUM(COALESCE(final_price, estimated_price)), 0),
        'avg_price', COALESCE(AVG(COALESCE(final_price, estimated_price)), 0)
      )
      FROM public.service_requests
      WHERE client_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    ),
    'avg_completion_time_hours', (
      SELECT COALESCE(
        EXTRACT(EPOCH FROM AVG(
          CASE
            WHEN assignment_status IN ('DELIVERED','COMPLETED')
             AND pickup_date IS NOT NULL
             AND delivered_ts IS NOT NULL
            THEN delivered_ts - pickup_date
          END
        )) / 3600,
        0
      )
      FROM freight_units
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_producer_report_charts(
  p_profile_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH freight_units AS (
    SELECT
      fa.id AS assignment_id,
      fa.freight_id,
      fa.driver_id,
      fa.status AS assignment_status,
      COALESCE(
        fa.agreed_price,
        (f.price / GREATEST(COALESCE(NULLIF(f.required_trucks, 0), 1), 1))
      )::numeric AS unit_price,
      f.cargo_type,
      f.origin_address,
      f.destination_address,
      COALESCE(fa.accepted_at, fa.created_at) AS unit_date
    FROM public.freight_assignments fa
    JOIN public.freights f ON f.id = fa.freight_id
    WHERE f.producer_id = p_profile_id
      AND COALESCE(fa.accepted_at, fa.created_at) >= p_start_at
      AND COALESCE(fa.accepted_at, fa.created_at) <= p_end_at
  )
  SELECT json_build_object(
    'spending_by_month', (
      SELECT COALESCE(json_agg(monthly ORDER BY monthly.month), '[]'::json)
      FROM (
        SELECT
          TO_CHAR(unit_date, 'YYYY-MM') AS month,
          COALESCE(SUM(unit_price) FILTER (WHERE assignment_status <> 'CANCELLED'), 0) AS freight_spending,
          0 AS service_spending
        FROM freight_units
        GROUP BY TO_CHAR(unit_date, 'YYYY-MM')
      ) monthly
    ),
    'by_status', (
      SELECT COALESCE(json_agg(status_data), '[]'::json)
      FROM (
        SELECT
          assignment_status::text AS name,
          COUNT(*) AS value
        FROM freight_units
        GROUP BY assignment_status
      ) status_data
    ),
    'by_cargo_type', (
      SELECT COALESCE(json_agg(cargo_data), '[]'::json)
      FROM (
        SELECT
          COALESCE(cargo_type, 'Não especificado') AS name,
          COUNT(*) AS value,
          COALESCE(SUM(unit_price) FILTER (WHERE assignment_status <> 'CANCELLED'), 0) AS total_value
        FROM freight_units
        GROUP BY cargo_type
        ORDER BY value DESC
        LIMIT 10
      ) cargo_data
    ),
    'top_drivers', (
      SELECT COALESCE(json_agg(driver_data), '[]'::json)
      FROM (
        SELECT
          p.full_name AS driver_name,
          COUNT(*) AS trips,
          COALESCE(AVG(fr.rating), 0) AS avg_rating,
          COALESCE(SUM(fu.unit_price) FILTER (WHERE fu.assignment_status <> 'CANCELLED'), 0) AS total_spent
        FROM freight_units fu
        JOIN public.profiles p ON p.id = fu.driver_id
        LEFT JOIN public.freight_ratings fr
          ON fr.freight_id = fu.freight_id
         AND fr.rated_user_id = fu.driver_id
        WHERE fu.driver_id IS NOT NULL
        GROUP BY p.id, p.full_name
        ORDER BY trips DESC
        LIMIT 5
      ) driver_data
    ),
    'top_providers', (
      SELECT COALESCE(json_agg(provider_data), '[]'::json)
      FROM (
        SELECT
          p.full_name AS provider_name,
          COUNT(*) AS services,
          COALESCE(AVG(sr.provider_rating), 0) AS avg_rating,
          COALESCE(SUM(COALESCE(sr.final_price, sr.estimated_price)), 0) AS total_spent
        FROM public.service_requests sr
        JOIN public.profiles p ON sr.provider_id = p.id
        WHERE sr.client_id = p_profile_id
          AND sr.provider_id IS NOT NULL
          AND sr.created_at >= p_start_at
          AND sr.created_at <= p_end_at
        GROUP BY p.id, p.full_name
        ORDER BY services DESC
        LIMIT 5
      ) provider_data
    ),
    'top_routes', (
      SELECT COALESCE(json_agg(route_data), '[]'::json)
      FROM (
        SELECT
          SPLIT_PART(origin_address, ',', 1) AS origin,
          SPLIT_PART(destination_address, ',', 1) AS destination,
          COUNT(*) AS count,
          COALESCE(SUM(unit_price) FILTER (WHERE assignment_status <> 'CANCELLED'), 0) AS total_value
        FROM freight_units
        GROUP BY SPLIT_PART(origin_address, ',', 1), SPLIT_PART(destination_address, ',', 1)
        ORDER BY count DESC
        LIMIT 5
      ) route_data
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;