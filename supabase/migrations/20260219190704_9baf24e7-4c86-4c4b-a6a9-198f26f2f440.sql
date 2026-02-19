
-- Drop e recria a função corrigindo 'srh.price' -> 'srh.final_price'
DROP FUNCTION IF EXISTS public.get_reports_dashboard(text, uuid, timestamptz, timestamptz, jsonb);

CREATE FUNCTION public.get_reports_dashboard(
  p_panel text,
  p_profile_id uuid,
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_company_id UUID;
  v_filter_tipo text[];
  v_filter_status text[];
  v_filter_uf text;
  v_filter_motoristas uuid[];
  v_has_tipo_filter boolean;
  v_has_status_filter boolean;
  v_has_uf_filter boolean;
  v_has_motoristas_filter boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_filter_tipo := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'tipo', '[]'::jsonb)));
  v_filter_status := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'status_final', '[]'::jsonb)));
  v_filter_uf := p_filters->>'uf';
  v_filter_motoristas := ARRAY(SELECT (jsonb_array_elements_text(COALESCE(p_filters->'motoristas', '[]'::jsonb)))::uuid);
  
  v_has_tipo_filter := array_length(v_filter_tipo, 1) IS NOT NULL;
  v_has_status_filter := array_length(v_filter_status, 1) IS NOT NULL;
  v_has_uf_filter := v_filter_uf IS NOT NULL AND v_filter_uf != '';
  v_has_motoristas_filter := array_length(v_filter_motoristas, 1) IS NOT NULL;

  IF p_panel != 'TRANSPORTADORA' THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = p_profile_id AND p.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Acesso negado: perfil não pertence ao usuário';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM transport_companies tc
      JOIN profiles p ON p.id = tc.profile_id
      WHERE tc.id = p_profile_id AND p.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Acesso negado: empresa não pertence ao usuário';
    END IF;
    v_company_id := p_profile_id;
  END IF;

  CASE p_panel
  WHEN 'PRODUTOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'freights_total', (SELECT COUNT(*) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fh.status_final = ANY(v_filter_status)) AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)),
          'freights_completed', (SELECT COUNT(*) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)),
          'freights_cancelled', (SELECT COUNT(*) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final = 'CANCELLED' AND fh.cancelled_at >= p_date_from AND fh.cancelled_at <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)),
          'freights_total_value', COALESCE((SELECT SUM(fh.price_total) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history srh WHERE srh.client_id = p_profile_id AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR srh.status_final = ANY(v_filter_status))),
          'services_completed', (SELECT COUNT(*) FROM service_request_history srh WHERE srh.client_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))),
          'services_total_value', COALESCE((SELECT SUM(srh.final_price) FROM service_request_history srh WHERE srh.client_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))), 0),
          'avg_freight_value', COALESCE((SELECT AVG(fh.price_total) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to), 0),
          'cancellation_rate', COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE fh.status_final = 'CANCELLED') / NULLIF(COUNT(*), 0), 1) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          'monthly_freights', (SELECT json_agg(row_to_json(t)) FROM (SELECT to_char(date_trunc('month', COALESCE(fh.completed_at, fh.created_at)), 'YYYY-MM') as month, COUNT(*) as total, COUNT(*) FILTER (WHERE fh.status_final IN ('COMPLETED','DELIVERED')) as completed, COUNT(*) FILTER (WHERE fh.status_final = 'CANCELLED') as cancelled, COALESCE(SUM(fh.price_total) FILTER (WHERE fh.status_final IN ('COMPLETED','DELIVERED')), 0) as revenue FROM freight_history fh WHERE fh.producer_id = p_profile_id AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf) GROUP BY 1 ORDER BY 1) t),
          'top_routes', (SELECT json_agg(row_to_json(t)) FROM (SELECT fh.origin_city, fh.origin_state, fh.destination_city, fh.destination_state, COUNT(*) as total, COALESCE(SUM(fh.price_total), 0) as total_revenue FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) GROUP BY fh.origin_city, fh.origin_state, fh.destination_city, fh.destination_state ORDER BY total DESC LIMIT 10) t),
          'cargo_distribution', (SELECT json_agg(row_to_json(t)) FROM (SELECT fh.cargo_type, COUNT(*) as total, COALESCE(SUM(fh.price_total), 0) as revenue FROM freight_history fh WHERE fh.producer_id = p_profile_id AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to GROUP BY fh.cargo_type ORDER BY total DESC) t)
        )
      ),
      'raw', (SELECT json_agg(row_to_json(t)) FROM (SELECT fh.freight_id, fh.cargo_type, fh.status_final, fh.origin_city, fh.origin_state, fh.destination_city, fh.destination_state, fh.distance_km, fh.weight, fh.price_total, fh.price_per_truck, fh.required_trucks, fh.accepted_trucks, fh.completed_at, fh.cancelled_at, fh.created_at FROM freight_history fh WHERE fh.producer_id = p_profile_id AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fh.status_final = ANY(v_filter_status)) AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf) ORDER BY COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) DESC LIMIT 500) t)
    ) INTO v_result;

  WHEN 'MOTORISTA' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'freights_total', (SELECT COUNT(*) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)),
          'freights_completed', (SELECT COUNT(*) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)),
          'total_revenue', COALESCE((SELECT SUM(fah.agreed_price) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)), 0),
          'total_distance', COALESCE((SELECT SUM(fah.distance_km) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)), 0),
          'total_weight', COALESCE((SELECT SUM(fah.weight_per_truck) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)), 0),
          'avg_revenue_per_km', COALESCE((SELECT ROUND(SUM(fah.agreed_price) / NULLIF(SUM(fah.distance_km), 0), 2) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo))), 0),
          'avg_revenue_per_ton', COALESCE((SELECT ROUND(SUM(fah.agreed_price) / NULLIF(SUM(fah.weight_per_truck) / 1000.0, 0), 2) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo))), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR srh.status_final = ANY(v_filter_status))),
          'services_revenue', COALESCE((SELECT SUM(srh.final_price) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))), 0),
          'total_combined_revenue', COALESCE((SELECT SUM(fah.agreed_price) FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0) + COALESCE((SELECT SUM(srh.final_price) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          'monthly_earnings', (SELECT json_agg(row_to_json(t)) FROM (SELECT to_char(date_trunc('month', fah.completed_at), 'YYYY-MM') as month, COUNT(*) as total, COALESCE(SUM(fah.agreed_price), 0) as revenue, COALESCE(SUM(fah.distance_km), 0) as distance_km FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) GROUP BY 1 ORDER BY 1) t),
          'top_routes', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state, COUNT(*) as total, COALESCE(SUM(fah.agreed_price), 0) as total_revenue, COALESCE(AVG(fah.agreed_price), 0) as avg_revenue FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) GROUP BY fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state ORDER BY total DESC LIMIT 10) t),
          'revenue_vs_distance', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.distance_km, fah.agreed_price as revenue, fah.cargo_type, fah.completed_at FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to ORDER BY fah.completed_at DESC LIMIT 100) t),
          'cargo_distribution', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.cargo_type, COUNT(*) as total, COALESCE(SUM(fah.agreed_price), 0) as revenue FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to GROUP BY fah.cargo_type ORDER BY total DESC) t)
        )
      ),
      'raw', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.freight_id, fah.cargo_type, fah.status_final, fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state, fah.distance_km, fah.weight_per_truck, fah.agreed_price, fah.completed_at, fah.created_at FROM freight_assignment_history fah WHERE fah.driver_id = p_profile_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) ORDER BY fah.completed_at DESC LIMIT 500) t)
    ) INTO v_result;

  WHEN 'TRANSPORTADORA' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'freights_total', (SELECT COUNT(*) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))),
          'freights_completed', (SELECT COUNT(*) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))),
          'total_revenue', COALESCE((SELECT SUM(fah.agreed_price) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))), 0),
          'total_distance', COALESCE((SELECT SUM(fah.distance_km) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))), 0),
          'active_drivers', (SELECT COUNT(DISTINCT fah.driver_id) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to),
          'avg_revenue_per_driver', COALESCE((SELECT ROUND(SUM(fah.agreed_price) / NULLIF(COUNT(DISTINCT fah.driver_id), 0), 2) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'cancellation_rate', COALESCE((SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') / NULLIF(COUNT(*), 0), 1) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          'monthly_earnings', (SELECT json_agg(row_to_json(t)) FROM (SELECT to_char(date_trunc('month', fah.completed_at), 'YYYY-MM') as month, COUNT(*) as total, COALESCE(SUM(fah.agreed_price), 0) as revenue, COUNT(DISTINCT fah.driver_id) as drivers_active FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas)) GROUP BY 1 ORDER BY 1) t),
          'driver_ranking', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.driver_id, COUNT(*) as freights_completed, COALESCE(SUM(fah.agreed_price), 0) as total_revenue, COALESCE(SUM(fah.distance_km), 0) as total_distance FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to GROUP BY fah.driver_id ORDER BY total_revenue DESC LIMIT 20) t),
          'top_routes', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state, COUNT(*) as total, COALESCE(SUM(fah.agreed_price), 0) as total_revenue FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to GROUP BY fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state ORDER BY total DESC LIMIT 10) t)
        )
      ),
      'raw', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.freight_id, fah.driver_id, fah.cargo_type, fah.status_final, fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state, fah.distance_km, fah.weight_per_truck, fah.agreed_price, fah.completed_at, fah.created_at FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status)) AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf) AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas)) ORDER BY fah.completed_at DESC LIMIT 500) t)
    ) INTO v_result;

  ELSE
    RAISE EXCEPTION 'Painel inválido: %', p_panel;
  END CASE;

  RETURN v_result;
END;
$$;
