-- ============================================
-- RPCs DE RELATÓRIOS - IMPLEMENTAÇÃO COMPLETA
-- ============================================

-- ==========================================
-- 1. GET_PRODUCER_REPORT_SUMMARY
-- ==========================================
CREATE OR REPLACE FUNCTION get_producer_report_summary(
  p_profile_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status IN ('PENDING', 'OPEN')),
        'in_transit', COUNT(*) FILTER (WHERE status = 'IN_TRANSIT'),
        'completed', COUNT(*) FILTER (WHERE status = 'DELIVERED'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'CANCELLED'),
        'total_spent', COALESCE(SUM(price), 0),
        'avg_price', COALESCE(AVG(price), 0),
        'avg_distance_km', COALESCE(AVG(distance_km), 0),
        'total_distance_km', COALESCE(SUM(distance_km), 0)
      )
      FROM freights
      WHERE producer_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
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
      FROM service_requests
      WHERE client_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    ),
    'avg_completion_time_hours', (
      SELECT COALESCE(
        EXTRACT(EPOCH FROM AVG(
          CASE WHEN status = 'DELIVERED' AND pickup_date IS NOT NULL AND delivery_date IS NOT NULL
          THEN delivery_date - pickup_date END
        )) / 3600,
        0
      )
      FROM freights
      WHERE producer_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- 2. GET_PRODUCER_REPORT_CHARTS
-- ==========================================
CREATE OR REPLACE FUNCTION get_producer_report_charts(
  p_profile_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'spending_by_month', (
      SELECT COALESCE(json_agg(monthly ORDER BY monthly.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(price) as freight_spending,
          0 as service_spending
        FROM freights
        WHERE producer_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) monthly
    ),
    'by_status', (
      SELECT COALESCE(json_agg(status_data), '[]'::json)
      FROM (
        SELECT 
          status::text as name,
          COUNT(*) as value
        FROM freights
        WHERE producer_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY status
      ) status_data
    ),
    'by_cargo_type', (
      SELECT COALESCE(json_agg(cargo_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(cargo_type, 'Não especificado') as name,
          COUNT(*) as value,
          COALESCE(SUM(price), 0) as total_value
        FROM freights
        WHERE producer_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY cargo_type
        ORDER BY value DESC
        LIMIT 10
      ) cargo_data
    ),
    'top_drivers', (
      SELECT COALESCE(json_agg(driver_data), '[]'::json)
      FROM (
        SELECT 
          p.full_name as driver_name,
          COUNT(*) as trips,
          COALESCE(AVG(fr.rating), 0) as avg_rating,
          COALESCE(SUM(f.price), 0) as total_spent
        FROM freights f
        JOIN profiles p ON f.driver_id = p.id
        LEFT JOIN freight_ratings fr ON fr.freight_id = f.id AND fr.rated_user_id = f.driver_id
        WHERE f.producer_id = p_profile_id
          AND f.driver_id IS NOT NULL
          AND f.created_at >= p_start_at
          AND f.created_at <= p_end_at
        GROUP BY p.id, p.full_name
        ORDER BY trips DESC
        LIMIT 5
      ) driver_data
    ),
    'top_providers', (
      SELECT COALESCE(json_agg(provider_data), '[]'::json)
      FROM (
        SELECT 
          p.full_name as provider_name,
          COUNT(*) as services,
          COALESCE(AVG(sr.provider_rating), 0) as avg_rating,
          COALESCE(SUM(COALESCE(sr.final_price, sr.estimated_price)), 0) as total_spent
        FROM service_requests sr
        JOIN profiles p ON sr.provider_id = p.id
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
          SPLIT_PART(origin_address, ',', 1) as origin,
          SPLIT_PART(destination_address, ',', 1) as destination,
          COUNT(*) as count,
          COALESCE(SUM(price), 0) as total_value
        FROM freights
        WHERE producer_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY SPLIT_PART(origin_address, ',', 1), SPLIT_PART(destination_address, ',', 1)
        ORDER BY count DESC
        LIMIT 5
      ) route_data
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- 3. GET_DRIVER_REPORT_SUMMARY
-- ==========================================
CREATE OR REPLACE FUNCTION get_driver_report_summary(
  p_profile_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'accepted', COUNT(*) FILTER (WHERE status NOT IN ('PENDING', 'OPEN', 'CANCELLED')),
        'completed', COUNT(*) FILTER (WHERE status = 'DELIVERED'),
        'in_transit', COUNT(*) FILTER (WHERE status = 'IN_TRANSIT'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'CANCELLED'),
        'total_revenue', COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN price ELSE 0 END), 0),
        'avg_revenue', COALESCE(AVG(CASE WHEN status = 'DELIVERED' THEN price END), 0)
      )
      FROM freights
      WHERE driver_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    ),
    'distance', (
      SELECT json_build_object(
        'total_km', COALESCE(SUM(distance_km), 0),
        'avg_per_freight', COALESCE(AVG(distance_km), 0)
      )
      FROM freights
      WHERE driver_id = p_profile_id
        AND status = 'DELIVERED'
        AND created_at >= p_start_at
        AND created_at <= p_end_at
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
        AND created_at >= p_start_at
        AND created_at <= p_end_at
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

-- ==========================================
-- 4. GET_DRIVER_REPORT_CHARTS
-- ==========================================
CREATE OR REPLACE FUNCTION get_driver_report_charts(
  p_profile_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'revenue_by_month', (
      SELECT COALESCE(json_agg(monthly ORDER BY monthly.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as freights,
          COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN price ELSE 0 END), 0) as revenue,
          COALESCE(SUM(distance_km), 0) as km
        FROM freights
        WHERE driver_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) monthly
    ),
    'by_status', (
      SELECT COALESCE(json_agg(status_data), '[]'::json)
      FROM (
        SELECT 
          status::text as name,
          COUNT(*) as value
        FROM freights
        WHERE driver_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY status
      ) status_data
    ),
    'by_cargo_type', (
      SELECT COALESCE(json_agg(cargo_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(cargo_type, 'Não especificado') as name,
          COUNT(*) as value
        FROM freights
        WHERE driver_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY cargo_type
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
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) rating_data
    ),
    'top_routes', (
      SELECT COALESCE(json_agg(route_data), '[]'::json)
      FROM (
        SELECT 
          SPLIT_PART(origin_address, ',', 1) as origin,
          SPLIT_PART(destination_address, ',', 1) as destination,
          COUNT(*) as count,
          COALESCE(SUM(price), 0) as total_revenue
        FROM freights
        WHERE driver_id = p_profile_id
          AND status = 'DELIVERED'
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY SPLIT_PART(origin_address, ',', 1), SPLIT_PART(destination_address, ',', 1)
        ORDER BY count DESC
        LIMIT 5
      ) route_data
    ),
    'top_states', (
      SELECT COALESCE(json_agg(state_data), '[]'::json)
      FROM (
        SELECT 
          SUBSTRING(origin_address FROM '[A-Z]{2}$') as state,
          COUNT(*) as count
        FROM freights
        WHERE driver_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY SUBSTRING(origin_address FROM '[A-Z]{2}$')
        HAVING SUBSTRING(origin_address FROM '[A-Z]{2}$') IS NOT NULL
        ORDER BY count DESC
        LIMIT 10
      ) state_data
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- 5. GET_PROVIDER_REPORT_SUMMARY
-- ==========================================
CREATE OR REPLACE FUNCTION get_provider_report_summary(
  p_profile_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
  v_total_requests BIGINT;
  v_completed_requests BIGINT;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Calcular totais para taxa de conversão
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total_requests, v_completed_requests
  FROM service_requests
  WHERE provider_id = p_profile_id
    AND created_at >= p_start_at
    AND created_at <= p_end_at;

  SELECT json_build_object(
    'services', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'accepted', COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress')),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
        'total_revenue', COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0),
        'avg_revenue', COALESCE(AVG(CASE WHEN status = 'completed' THEN COALESCE(final_price, estimated_price) END), 0)
      )
      FROM service_requests
      WHERE provider_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    ),
    'ratings', (
      SELECT json_build_object(
        'average', COALESCE(AVG(provider_rating), 0),
        'total', COUNT(*) FILTER (WHERE provider_rating IS NOT NULL),
        'five_star', COUNT(*) FILTER (WHERE provider_rating = 5),
        'four_star', COUNT(*) FILTER (WHERE provider_rating = 4),
        'three_star', COUNT(*) FILTER (WHERE provider_rating = 3),
        'two_star', COUNT(*) FILTER (WHERE provider_rating = 2),
        'one_star', COUNT(*) FILTER (WHERE provider_rating = 1)
      )
      FROM service_requests
      WHERE provider_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    ),
    'conversion_rate', CASE 
      WHEN v_total_requests > 0 THEN ROUND((v_completed_requests::numeric / v_total_requests::numeric) * 100, 2)
      ELSE 0 
    END,
    'avg_service_time_hours', (
      SELECT COALESCE(
        EXTRACT(EPOCH FROM AVG(completed_at - accepted_at)) / 3600,
        0
      )
      FROM service_requests
      WHERE provider_id = p_profile_id
        AND status = 'completed'
        AND completed_at IS NOT NULL
        AND accepted_at IS NOT NULL
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- 6. GET_PROVIDER_REPORT_CHARTS
-- ==========================================
CREATE OR REPLACE FUNCTION get_provider_report_charts(
  p_profile_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'revenue_by_month', (
      SELECT COALESCE(json_agg(monthly ORDER BY monthly.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as services,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0) as revenue
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) monthly
    ),
    'by_status', (
      SELECT COALESCE(json_agg(status_data), '[]'::json)
      FROM (
        SELECT 
          status as name,
          COUNT(*) as value
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY status
      ) status_data
    ),
    'by_category', (
      SELECT COALESCE(json_agg(cat_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(service_type, 'Não especificado') as name,
          COUNT(*) as value,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0) as revenue
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY service_type
        ORDER BY value DESC
        LIMIT 10
      ) cat_data
    ),
    'ratings_trend', (
      SELECT COALESCE(json_agg(rating_data ORDER BY rating_data.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COALESCE(AVG(provider_rating), 0) as avg_rating,
          COUNT(*) FILTER (WHERE provider_rating IS NOT NULL) as count
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ) rating_data
    ),
    'by_day_of_week', (
      SELECT COALESCE(json_agg(day_data ORDER BY day_data.day_num), '[]'::json)
      FROM (
        SELECT 
          EXTRACT(DOW FROM created_at) as day_num,
          CASE EXTRACT(DOW FROM created_at)
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
          END as day_name,
          COUNT(*) as count
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY EXTRACT(DOW FROM created_at)
      ) day_data
    ),
    'emergency_vs_regular', (
      SELECT json_build_object(
        'emergency', COUNT(*) FILTER (WHERE is_emergency = true),
        'regular', COUNT(*) FILTER (WHERE is_emergency = false OR is_emergency IS NULL)
      )
      FROM service_requests
      WHERE provider_id = p_profile_id
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- 7. GET_COMPANY_REPORT_SUMMARY
-- ==========================================
CREATE OR REPLACE FUNCTION get_company_report_summary(
  p_company_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
  v_profile_id UUID;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o usuário é dono/gerente da transportadora
  SELECT profile_id INTO v_profile_id
  FROM transport_companies
  WHERE id = p_company_id;
  
  IF v_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE f.status IN ('IN_TRANSIT', 'LOADING', 'READY_FOR_PICKUP')),
        'completed', COUNT(*) FILTER (WHERE f.status = 'DELIVERED'),
        'cancelled', COUNT(*) FILTER (WHERE f.status = 'CANCELLED'),
        'total_revenue', COALESCE(SUM(CASE WHEN f.status = 'DELIVERED' THEN fa.agreed_price ELSE 0 END), 0),
        'avg_revenue', COALESCE(AVG(CASE WHEN f.status = 'DELIVERED' THEN fa.agreed_price END), 0)
      )
      FROM freight_assignments fa
      JOIN freights f ON f.id = fa.freight_id
      WHERE fa.company_id = p_company_id
        AND fa.created_at >= p_start_at
        AND fa.created_at <= p_end_at
    ),
    'drivers', (
      SELECT json_build_object(
        'total', COUNT(DISTINCT cd.driver_profile_id),
        'active', COUNT(DISTINCT cd.driver_profile_id) FILTER (WHERE cd.status = 'active'),
        'own', COUNT(DISTINCT cd.driver_profile_id) FILTER (WHERE cd.affiliation_type = 'own'),
        'third_party', COUNT(DISTINCT cd.driver_profile_id) FILTER (WHERE cd.affiliation_type = 'third_party' OR cd.affiliation_type IS NULL)
      )
      FROM company_drivers cd
      WHERE cd.company_id = p_company_id
    ),
    'vehicles', (
      SELECT json_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE is_active = true)
      )
      FROM vehicles
      WHERE company_id = p_company_id
    ),
    'delay_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE f.delivery_date < fa.delivered_at)::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0
      END
      FROM freight_assignments fa
      JOIN freights f ON f.id = fa.freight_id
      WHERE fa.company_id = p_company_id
        AND f.status = 'DELIVERED'
        AND fa.created_at >= p_start_at
        AND fa.created_at <= p_end_at
    ),
    'cancellation_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 THEN 
          ROUND((COUNT(*) FILTER (WHERE f.status = 'CANCELLED')::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0
      END
      FROM freight_assignments fa
      JOIN freights f ON f.id = fa.freight_id
      WHERE fa.company_id = p_company_id
        AND fa.created_at >= p_start_at
        AND fa.created_at <= p_end_at
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- 8. GET_COMPANY_REPORT_CHARTS
-- ==========================================
CREATE OR REPLACE FUNCTION get_company_report_charts(
  p_company_id UUID,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
  v_profile_id UUID;
BEGIN
  -- Validação de segurança
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Verificar se o usuário é dono/gerente da transportadora
  SELECT profile_id INTO v_profile_id
  FROM transport_companies
  WHERE id = p_company_id;
  
  IF v_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'revenue_by_month', (
      SELECT COALESCE(json_agg(monthly ORDER BY monthly.month), '[]'::json)
      FROM (
        SELECT 
          TO_CHAR(fa.created_at, 'YYYY-MM') as month,
          COUNT(*) as freights,
          COALESCE(SUM(CASE WHEN f.status = 'DELIVERED' THEN fa.agreed_price ELSE 0 END), 0) as revenue
        FROM freight_assignments fa
        JOIN freights f ON f.id = fa.freight_id
        WHERE fa.company_id = p_company_id
          AND fa.created_at >= p_start_at
          AND fa.created_at <= p_end_at
        GROUP BY TO_CHAR(fa.created_at, 'YYYY-MM')
      ) monthly
    ),
    'by_status', (
      SELECT COALESCE(json_agg(status_data), '[]'::json)
      FROM (
        SELECT 
          f.status::text as name,
          COUNT(*) as value
        FROM freight_assignments fa
        JOIN freights f ON f.id = fa.freight_id
        WHERE fa.company_id = p_company_id
          AND fa.created_at >= p_start_at
          AND fa.created_at <= p_end_at
        GROUP BY f.status
      ) status_data
    ),
    'by_cargo_type', (
      SELECT COALESCE(json_agg(cargo_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(f.cargo_type, 'Não especificado') as name,
          COUNT(*) as value
        FROM freight_assignments fa
        JOIN freights f ON f.id = fa.freight_id
        WHERE fa.company_id = p_company_id
          AND fa.created_at >= p_start_at
          AND fa.created_at <= p_end_at
        GROUP BY f.cargo_type
        ORDER BY value DESC
        LIMIT 10
      ) cargo_data
    ),
    'drivers_performance', (
      SELECT COALESCE(json_agg(driver_data), '[]'::json)
      FROM (
        SELECT 
          p.full_name as driver_name,
          COUNT(*) as freights,
          COUNT(*) FILTER (WHERE f.status = 'DELIVERED') as completed,
          COALESCE(SUM(CASE WHEN f.status = 'DELIVERED' THEN fa.agreed_price ELSE 0 END), 0) as revenue,
          COALESCE(AVG(fr.rating), 0) as avg_rating
        FROM freight_assignments fa
        JOIN freights f ON f.id = fa.freight_id
        JOIN profiles p ON fa.driver_id = p.id
        LEFT JOIN freight_ratings fr ON fr.freight_id = f.id AND fr.rated_user_id = fa.driver_id
        WHERE fa.company_id = p_company_id
          AND fa.created_at >= p_start_at
          AND fa.created_at <= p_end_at
        GROUP BY p.id, p.full_name
        ORDER BY revenue DESC
        LIMIT 10
      ) driver_data
    ),
    'own_vs_third_party', (
      SELECT json_build_object(
        'own', COALESCE(SUM(CASE WHEN cd.affiliation_type = 'own' THEN fa.agreed_price ELSE 0 END), 0),
        'third_party', COALESCE(SUM(CASE WHEN cd.affiliation_type != 'own' OR cd.affiliation_type IS NULL THEN fa.agreed_price ELSE 0 END), 0)
      )
      FROM freight_assignments fa
      JOIN freights f ON f.id = fa.freight_id
      LEFT JOIN company_drivers cd ON cd.driver_profile_id = fa.driver_id AND cd.company_id = fa.company_id
      WHERE fa.company_id = p_company_id
        AND f.status = 'DELIVERED'
        AND fa.created_at >= p_start_at
        AND fa.created_at <= p_end_at
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- ==========================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_freights_producer_created 
ON freights(producer_id, created_at);

CREATE INDEX IF NOT EXISTS idx_freights_driver_created 
ON freights(driver_id, created_at);

CREATE INDEX IF NOT EXISTS idx_service_requests_provider_created 
ON service_requests(provider_id, created_at);

CREATE INDEX IF NOT EXISTS idx_service_requests_client_created 
ON service_requests(client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_freight_assignments_company_created 
ON freight_assignments(company_id, created_at);

CREATE INDEX IF NOT EXISTS idx_driver_expenses_driver_date 
ON driver_expenses(driver_id, expense_date);

CREATE INDEX IF NOT EXISTS idx_freight_ratings_rated_user_created 
ON freight_ratings(rated_user_id, created_at);