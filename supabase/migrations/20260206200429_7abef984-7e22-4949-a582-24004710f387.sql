
-- =============================================================
-- FIX: RPCs de relatórios do motorista devem incluir fretes multi-carreta
-- O motorista está vinculado via freight_assignments, não via freights.driver_id
-- =============================================================

-- Drop e recria get_driver_report_summary
CREATE OR REPLACE FUNCTION public.get_driver_report_summary(
  p_profile_id UUID,
  p_start_at TEXT,
  p_end_at TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'accepted', COUNT(*) FILTER (WHERE f.status NOT IN ('OPEN', 'CANCELLED')),
        'completed', COUNT(*) FILTER (WHERE f.status = 'DELIVERED' OR fa_status = 'DELIVERED'),
        'in_transit', COUNT(*) FILTER (WHERE f.status = 'IN_TRANSIT'),
        'cancelled', COUNT(*) FILTER (WHERE f.status = 'CANCELLED'),
        'total_revenue', COALESCE(SUM(
          CASE WHEN f.status = 'DELIVERED' OR fa_status = 'DELIVERED' 
          THEN COALESCE(fa_price, f.price, 0) ELSE 0 END
        ), 0),
        'avg_revenue', COALESCE(AVG(
          CASE WHEN f.status = 'DELIVERED' OR fa_status = 'DELIVERED' 
          THEN COALESCE(fa_price, f.price) END
        ), 0)
      )
      FROM (
        -- Fretes diretos (driver_id no frete)
        SELECT f.id, f.status, f.price, f.created_at, NULL::text as fa_status, NULL::numeric as fa_price, f.distance_km
        FROM freights f
        WHERE f.driver_id = p_profile_id
          AND f.created_at >= p_start_at::timestamptz
          AND f.created_at <= p_end_at::timestamptz
        
        UNION
        
        -- Fretes via assignment (multi-carreta)
        SELECT f.id, f.status, f.price, f.created_at, fa.status as fa_status, fa.agreed_price as fa_price, f.distance_km
        FROM freights f
        INNER JOIN freight_assignments fa ON fa.freight_id = f.id
        WHERE fa.driver_id = p_profile_id
          AND f.created_at >= p_start_at::timestamptz
          AND f.created_at <= p_end_at::timestamptz
          AND f.driver_id IS DISTINCT FROM p_profile_id -- evitar duplicatas
      ) f
    ),
    'distance', (
      SELECT json_build_object(
        'total_km', COALESCE(SUM(f.distance_km), 0),
        'avg_per_freight', COALESCE(AVG(f.distance_km), 0)
      )
      FROM (
        SELECT f.distance_km
        FROM freights f
        WHERE f.driver_id = p_profile_id
          AND f.status = 'DELIVERED'
          AND f.created_at >= p_start_at::timestamptz
          AND f.created_at <= p_end_at::timestamptz
        
        UNION ALL
        
        SELECT f.distance_km
        FROM freights f
        INNER JOIN freight_assignments fa ON fa.freight_id = f.id
        WHERE fa.driver_id = p_profile_id
          AND fa.status = 'DELIVERED'
          AND f.created_at >= p_start_at::timestamptz
          AND f.created_at <= p_end_at::timestamptz
          AND f.driver_id IS DISTINCT FROM p_profile_id
      ) f
    ),
    'ratings', (
      SELECT json_build_object(
        'average', COALESCE(AVG(rating), 0),
        'total', COUNT(*),
        'five_star', COUNT(*) FILTER (WHERE rating = 5),
        'four_star', COUNT(*) FILTER (WHERE rating = 4),
        'three_star', COUNT(*) FILTER (WHERE rating = 3),
        'two_star', COUNT(*) FILTER (WHERE rating = 2),
        'one_star', COUNT(*) FILTER (WHERE rating = 1)
      )
      FROM freight_ratings
      WHERE rated_user_id = p_profile_id
        AND created_at >= p_start_at::timestamptz
        AND created_at <= p_end_at::timestamptz
    ),
    'expenses', (
      SELECT json_build_object(
        'total', COALESCE(SUM(amount), 0),
        'fuel', COALESCE(SUM(amount) FILTER (WHERE expense_type = 'FUEL'), 0),
        'maintenance', COALESCE(SUM(amount) FILTER (WHERE expense_type = 'MAINTENANCE'), 0),
        'toll', COALESCE(SUM(amount) FILTER (WHERE expense_type = 'TOLL'), 0),
        'tire', COALESCE(SUM(amount) FILTER (WHERE expense_type = 'TIRE'), 0),
        'other', COALESCE(SUM(amount) FILTER (WHERE expense_type = 'OTHER'), 0)
      )
      FROM driver_expenses
      WHERE driver_id = p_profile_id
        AND expense_date >= p_start_at::date
        AND expense_date <= p_end_at::date
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Drop e recria get_driver_report_charts
CREATE OR REPLACE FUNCTION public.get_driver_report_charts(
  p_profile_id UUID,
  p_start_at TEXT,
  p_end_at TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'revenue_by_month', (
      SELECT COALESCE(json_agg(monthly ORDER BY monthly.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(f.created_at, 'YYYY-MM') as month,
          COUNT(*) as freights,
          COALESCE(SUM(CASE WHEN f.effective_status = 'DELIVERED' THEN COALESCE(f.effective_price, 0) ELSE 0 END), 0) as revenue,
          COALESCE(SUM(f.distance_km), 0) as km
        FROM (
          SELECT f.id, f.created_at, f.status as effective_status, f.price as effective_price, f.distance_km
          FROM freights f WHERE f.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
          UNION
          SELECT f.id, f.created_at, fa.status as effective_status, fa.agreed_price as effective_price, f.distance_km
          FROM freights f INNER JOIN freight_assignments fa ON fa.freight_id = f.id
          WHERE fa.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
            AND f.driver_id IS DISTINCT FROM p_profile_id
        ) f
        GROUP BY TO_CHAR(f.created_at, 'YYYY-MM')
      ) monthly
    ),
    'by_status', (
      SELECT COALESCE(json_agg(status_data), '[]'::json)
      FROM (
        SELECT 
          f.effective_status::text as name,
          COUNT(*) as value
        FROM (
          SELECT f.id, f.status as effective_status
          FROM freights f WHERE f.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
          UNION
          SELECT f.id, fa.status as effective_status
          FROM freights f INNER JOIN freight_assignments fa ON fa.freight_id = f.id
          WHERE fa.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
            AND f.driver_id IS DISTINCT FROM p_profile_id
        ) f
        GROUP BY f.effective_status
      ) status_data
    ),
    'by_cargo_type', (
      SELECT COALESCE(json_agg(cargo_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(f.cargo_type, 'Não especificado') as name,
          COUNT(*) as value
        FROM (
          SELECT f.id, f.cargo_type
          FROM freights f WHERE f.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
          UNION
          SELECT f.id, f.cargo_type
          FROM freights f INNER JOIN freight_assignments fa ON fa.freight_id = f.id
          WHERE fa.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
            AND f.driver_id IS DISTINCT FROM p_profile_id
        ) f
        GROUP BY f.cargo_type
        ORDER BY value DESC
        LIMIT 10
      ) cargo_data
    ),
    'expenses_by_type', (
      SELECT COALESCE(json_agg(expense_data), '[]'::json)
      FROM (
        SELECT 
          expense_type as name,
          COALESCE(SUM(amount), 0) as value
        FROM driver_expenses
        WHERE driver_id = p_profile_id
          AND expense_date >= p_start_at::date
          AND expense_date <= p_end_at::date
        GROUP BY expense_type
        ORDER BY value DESC
      ) expense_data
    ),
    'ratings_trend', (
      SELECT COALESCE(json_agg(rating_data ORDER BY rating_data.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COALESCE(AVG(rating), 0) as avg_rating,
          COUNT(*) as count
        FROM freight_ratings
        WHERE rated_user_id = p_profile_id
          AND created_at >= p_start_at::timestamptz
          AND created_at <= p_end_at::timestamptz
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) rating_data
    ),
    'top_routes', (
      SELECT COALESCE(json_agg(route_data), '[]'::json)
      FROM (
        SELECT 
          f.origin as origin,
          f.destination as destination,
          COUNT(*) as count,
          COALESCE(SUM(f.effective_price), 0) as total_revenue
        FROM (
          SELECT f.id, COALESCE(f.origin_city, SPLIT_PART(f.origin_address, ',', 1)) as origin,
                 COALESCE(f.destination_city, SPLIT_PART(f.destination_address, ',', 1)) as destination,
                 f.price as effective_price
          FROM freights f WHERE f.driver_id = p_profile_id
            AND f.status = 'DELIVERED'
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
          UNION
          SELECT f.id, COALESCE(f.origin_city, SPLIT_PART(f.origin_address, ',', 1)) as origin,
                 COALESCE(f.destination_city, SPLIT_PART(f.destination_address, ',', 1)) as destination,
                 fa.agreed_price as effective_price
          FROM freights f INNER JOIN freight_assignments fa ON fa.freight_id = f.id
          WHERE fa.driver_id = p_profile_id AND fa.status = 'DELIVERED'
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
            AND f.driver_id IS DISTINCT FROM p_profile_id
        ) f
        GROUP BY f.origin, f.destination
        ORDER BY count DESC
        LIMIT 5
      ) route_data
    ),
    'top_states', (
      SELECT COALESCE(json_agg(state_data), '[]'::json)
      FROM (
        SELECT 
          f.state as state,
          COUNT(*) as count
        FROM (
          SELECT f.id, COALESCE(f.origin_state, SUBSTRING(f.origin_address FROM '[A-Z]{2}$')) as state
          FROM freights f WHERE f.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
          UNION
          SELECT f.id, COALESCE(f.origin_state, SUBSTRING(f.origin_address FROM '[A-Z]{2}$')) as state
          FROM freights f INNER JOIN freight_assignments fa ON fa.freight_id = f.id
          WHERE fa.driver_id = p_profile_id
            AND f.created_at >= p_start_at::timestamptz AND f.created_at <= p_end_at::timestamptz
            AND f.driver_id IS DISTINCT FROM p_profile_id
        ) f
        WHERE f.state IS NOT NULL
        GROUP BY f.state
        ORDER BY count DESC
        LIMIT 10
      ) state_data
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
