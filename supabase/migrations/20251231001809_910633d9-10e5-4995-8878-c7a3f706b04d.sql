-- Fix report RPCs: remove invalid freight_status literals

CREATE OR REPLACE FUNCTION public.get_driver_report_summary(p_profile_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
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
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'accepted', COUNT(*) FILTER (WHERE status NOT IN ('OPEN', 'CANCELLED')),
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
$function$;


CREATE OR REPLACE FUNCTION public.get_producer_report_summary(p_profile_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
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
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status IN ('OPEN')),
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
$function$;


CREATE OR REPLACE FUNCTION public.get_company_report_summary(p_company_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_profile_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT profile_id INTO v_profile_id
  FROM transport_companies
  WHERE id = p_company_id;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = v_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'freights', (
      SELECT json_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE f.status IN ('IN_TRANSIT', 'LOADING', 'LOADED')),
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
$function$;


-- Guardrails (match quoted literals only)
DO $$
DECLARE
  v_cnt int;
BEGIN
  SELECT COUNT(*) INTO v_cnt
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'get\_%\_report\_%' ESCAPE '\'
    AND (
      pg_get_functiondef(p.oid) LIKE '%''PENDING''%'
      OR pg_get_functiondef(p.oid) LIKE '%''READY_FOR_PICKUP''%'
    );

  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'Ainda existem RPCs de relatório com literais inválidos em freight_status.';
  END IF;
END $$;