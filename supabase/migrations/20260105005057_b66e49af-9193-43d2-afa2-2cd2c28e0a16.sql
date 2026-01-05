-- CORREÇÃO PROBLEMA 6: Atualizar funções de relatórios do prestador para usar status MAIÚSCULO
-- O sistema usa status em MAIÚSCULO (COMPLETED, PENDING, etc.), mas as funções usavam minúsculo

-- Atualizar get_provider_report_summary
CREATE OR REPLACE FUNCTION public.get_provider_report_summary(p_profile_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_total_requests BIGINT;
  v_completed_requests BIGINT;
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

  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'completed'))
  INTO v_total_requests, v_completed_requests
  FROM service_requests
  WHERE provider_id = p_profile_id
    AND created_at >= p_start_at
    AND created_at <= p_end_at;

  SELECT json_build_object(
    'services', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE UPPER(status) = 'PENDING' OR UPPER(status) = 'OPEN'),
        'accepted', COUNT(*) FILTER (WHERE UPPER(status) IN ('ACCEPTED', 'IN_PROGRESS')),
        'completed', COUNT(*) FILTER (WHERE UPPER(status) = 'COMPLETED'),
        'cancelled', COUNT(*) FILTER (WHERE UPPER(status) = 'CANCELLED'),
        'in_progress', COUNT(*) FILTER (WHERE UPPER(status) = 'IN_PROGRESS'),
        'total_revenue', COALESCE(SUM(CASE WHEN UPPER(status) = 'COMPLETED' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0),
        'avg_revenue', COALESCE(AVG(CASE WHEN UPPER(status) = 'COMPLETED' THEN COALESCE(final_price, estimated_price) END), 0)
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
        AND UPPER(status) = 'COMPLETED'
        AND completed_at IS NOT NULL
        AND accepted_at IS NOT NULL
        AND created_at >= p_start_at
        AND created_at <= p_end_at
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Atualizar get_provider_report_charts
CREATE OR REPLACE FUNCTION public.get_provider_report_charts(p_profile_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as services,
          COALESCE(SUM(CASE WHEN UPPER(status) = 'COMPLETED' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0) as revenue
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
          UPPER(status) as name,
          COUNT(*) as value
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY UPPER(status)
      ) status_data
    ),
    'by_category', (
      SELECT COALESCE(json_agg(cat_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(service_type, 'Não especificado') as name,
          COUNT(*) as value,
          COALESCE(SUM(CASE WHEN UPPER(status) = 'COMPLETED' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0) as revenue
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
    'top_cities', (
      SELECT COALESCE(json_agg(city_data), '[]'::json)
      FROM (
        SELECT 
          COALESCE(city_name, 'Não especificado') as city,
          COALESCE(state, 'N/A') as state,
          COUNT(*) as count,
          COALESCE(SUM(CASE WHEN UPPER(status) = 'COMPLETED' THEN COALESCE(final_price, estimated_price) ELSE 0 END), 0) as revenue
        FROM service_requests
        WHERE provider_id = p_profile_id
          AND created_at >= p_start_at
          AND created_at <= p_end_at
        GROUP BY city_name, state
        ORDER BY count DESC
        LIMIT 5
      ) city_data
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;