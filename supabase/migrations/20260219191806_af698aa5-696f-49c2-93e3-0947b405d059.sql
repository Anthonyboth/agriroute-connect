
-- Fix get_reports_dashboard MOTORISTA panel:
-- 1. freight_assignment_history uses 'agreed_price' (not 'final_price')
-- 2. service_request_history should use COALESCE(final_price, estimated_price) as the price field
-- 3. Also fix status_final filter: freight_assignment_history uses 'DELIVERED' not 'COMPLETED'

CREATE OR REPLACE FUNCTION public.get_reports_dashboard(
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
          'services_total_value', COALESCE((SELECT SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh WHERE srh.client_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))), 0),
          'avg_freight_value', COALESCE((SELECT AVG(fh.price_total) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to), 0),
          'ticket_medio_frete', COALESCE((SELECT AVG(fh.price_total) FROM freight_history fh WHERE fh.producer_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to), 0),
          'ticket_medio_servico', COALESCE((SELECT AVG(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh WHERE srh.client_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          'receita_por_mes', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(fh.completed_at, fh.created_at)), 'YYYY-MM') as mes,
                     COALESCE(SUM(fh.price_total), 0) as receita
              FROM freight_history fh
              WHERE fh.producer_id = p_profile_id
                AND COALESCE(fh.completed_at, fh.created_at) >= p_date_from
                AND COALESCE(fh.completed_at, fh.created_at) <= p_date_to
              GROUP BY 1 ORDER BY 1
            ) t
          ),
          'por_status', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fh.status_final as name, COUNT(*) as value
              FROM freight_history fh
              WHERE fh.producer_id = p_profile_id
                AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from
                AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to
              GROUP BY 1 ORDER BY 2 DESC
            ) t
          ),
          'por_tipo_carga', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fh.cargo_type as name, COUNT(*) as value
              FROM freight_history fh
              WHERE fh.producer_id = p_profile_id
                AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from
                AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to
              GROUP BY 1 ORDER BY 2 DESC
            ) t
          ),
          'volume_por_dia', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(COALESCE(fh.completed_at, fh.created_at), 'DD/MM') as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history fh
              WHERE fh.producer_id = p_profile_id
                AND COALESCE(fh.completed_at, fh.created_at) >= p_date_from
                AND COALESCE(fh.completed_at, fh.created_at) <= p_date_to
              GROUP BY 1 ORDER BY MIN(COALESCE(fh.completed_at, fh.created_at))
            ) t
          )
        )
      ),
      'tables', '[]'::json
    ) INTO v_result;

  WHEN 'MOTORISTA' THEN
    -- Uses freight_assignment_history (agreed_price) + service_request_history (COALESCE(final_price, estimated_price))
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          -- Fretes: usa freight_assignment_history com agreed_price
          'total_fretes', (
            SELECT COUNT(*) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)
          ),
          'fretes_concluidos', (
            SELECT COUNT(*) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)
          ),
          'receita_total', COALESCE((
            SELECT SUM(fah.agreed_price) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fah.origin_state = v_filter_uf OR fah.destination_state = v_filter_uf)
          ), 0),
          -- Serviços: usa service_request_history com COALESCE(final_price, estimated_price)
          'servicos_receita', COALESCE((
            SELECT SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id
              AND srh.status_final = 'COMPLETED'
              AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
          ), 0),
          'distancia_total_km', COALESCE((
            SELECT SUM(fah.distance_km) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'rs_por_km', COALESCE((
            SELECT CASE WHEN SUM(fah.distance_km) > 0 THEN SUM(fah.agreed_price) / SUM(fah.distance_km) ELSE 0 END
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'rs_por_ton', COALESCE((
            SELECT CASE WHEN SUM(fah.weight_per_truck) > 0 THEN SUM(fah.agreed_price) / SUM(fah.weight_per_truck) ELSE 0 END
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'peso_total', COALESCE((
            SELECT SUM(fah.weight_per_truck) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'km_medio_viagem', COALESCE((
            SELECT AVG(fah.distance_km) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'ticket_medio', COALESCE((
            SELECT AVG(fah.agreed_price) FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'taxa_cancelamento', COALESCE((
            SELECT CASE WHEN COUNT(*) > 0 THEN
              (COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED')::float / COUNT(*)) * 100
            ELSE 0 END
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
          ), 0),
          'tempo_medio_ciclo_horas', COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (fah.completed_at - fah.created_at)) / 3600)
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'despesas_total', COALESCE((
            SELECT SUM(de.amount) FROM driver_expenses de
            WHERE de.driver_id = p_profile_id
              AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
          ), 0),
          'avaliacao_media', COALESCE((
            SELECT AVG(r.rating) FROM ratings r
            WHERE r.rated_id = p_profile_id
              AND r.created_at >= p_date_from AND r.created_at <= p_date_to
          ), 0),
          'total_avaliacoes', COALESCE((
            SELECT COUNT(*) FROM ratings r
            WHERE r.rated_id = p_profile_id
              AND r.created_at >= p_date_from AND r.created_at <= p_date_to
          ), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          -- Receita por dia
          'receita_por_dia', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(fah.completed_at, 'DD/MM') as dia,
                     COALESCE(SUM(fah.agreed_price), 0) as receita
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY 1, DATE_TRUNC('day', fah.completed_at) ORDER BY DATE_TRUNC('day', fah.completed_at)
            ) t
          ),
          -- Receita por mês
          'receita_por_mes', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(DATE_TRUNC('month', fah.completed_at), 'YYYY-MM') as mes,
                     COALESCE(SUM(fah.agreed_price), 0) as receita
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY 1 ORDER BY 1
            ) t
          ),
          -- Despesas por mês
          'despesas_por_mes', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(DATE_TRUNC('month', de.expense_date::timestamptz), 'YYYY-MM') as mes,
                     COALESCE(SUM(de.amount), 0) as despesas
              FROM driver_expenses de
              WHERE de.driver_id = p_profile_id
                AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
              GROUP BY 1 ORDER BY 1
            ) t
          ),
          -- Despesas por tipo
          'despesas_por_tipo', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT de.expense_type as name, COALESCE(SUM(de.amount), 0) as value
              FROM driver_expenses de
              WHERE de.driver_id = p_profile_id
                AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
              GROUP BY 1 ORDER BY 2 DESC
            ) t
          ),
          -- Volume por dia (fretes + serviços)
          'volume_por_dia', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(fah.completed_at, 'DD/MM') as dia,
                     COUNT(*) as fretes, 0 as servicos
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY 1, DATE_TRUNC('day', fah.completed_at) ORDER BY DATE_TRUNC('day', fah.completed_at)
            ) t
          ),
          -- Km por dia
          'km_por_dia', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(fah.completed_at, 'DD/MM') as dia,
                     COALESCE(SUM(fah.distance_km), 0) as km
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY 1, DATE_TRUNC('day', fah.completed_at) ORDER BY DATE_TRUNC('day', fah.completed_at)
            ) t
          ),
          -- Por status
          'por_status', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fah.status_final as name, COUNT(*) as value
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              GROUP BY 1 ORDER BY 2 DESC
            ) t
          ),
          -- Por tipo de carga
          'por_tipo_carga', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fah.cargo_type as name, COUNT(*) as value
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
                AND fah.cargo_type IS NOT NULL
              GROUP BY 1 ORDER BY 2 DESC
            ) t
          ),
          -- Top rotas por receita
          'top_rotas', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fah.origin_city as origem, fah.destination_city as destino,
                     COUNT(*) as viagens,
                     COALESCE(SUM(fah.agreed_price), 0) as receita,
                     COALESCE(AVG(fah.distance_km), 0) as km_medio
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND fah.origin_city IS NOT NULL AND fah.destination_city IS NOT NULL
              GROUP BY 1, 2 ORDER BY receita DESC
              LIMIT 10
            ) t
          ),
          -- Scatter: R$/km vs Distância
          'scatter_rs_km', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fah.distance_km as km,
                     CASE WHEN fah.distance_km > 0 THEN ROUND((fah.agreed_price / fah.distance_km)::numeric, 2) ELSE 0 END as rs_km,
                     CONCAT(fah.origin_city, ' → ', fah.destination_city) as rota
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND fah.distance_km > 0 AND fah.agreed_price > 0
            ) t
          ),
          -- Avaliações distribuição
          'avaliacoes_distribuicao', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT r.rating as name, COUNT(*) as value
              FROM ratings r
              WHERE r.rated_id = p_profile_id
                AND r.created_at >= p_date_from AND r.created_at <= p_date_to
              GROUP BY 1 ORDER BY 1
            ) t
          ),
          -- Avaliações trend por mês
          'avaliacoes_trend', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT TO_CHAR(DATE_TRUNC('month', r.created_at), 'YYYY-MM') as mes,
                     ROUND(AVG(r.rating)::numeric, 2) as media
              FROM ratings r
              WHERE r.rated_id = p_profile_id
                AND r.created_at >= p_date_from AND r.created_at <= p_date_to
              GROUP BY 1 ORDER BY 1
            ) t
          )
        )
      ),
      'tables', (
        SELECT json_build_object(
          -- Extrato completo de ganhos
          'extrato_ganhos', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fah.completed_at as data,
                     'Frete' as tipo,
                     fah.origin_city,
                     fah.destination_city,
                     fah.distance_km as km,
                     fah.agreed_price as receita,
                     CASE WHEN fah.distance_km > 0 THEN ROUND((fah.agreed_price / fah.distance_km)::numeric, 2) ELSE 0 END as rs_km,
                     fah.status_final
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              ORDER BY fah.completed_at DESC NULLS LAST
              LIMIT 100
            ) t
          ),
          -- Top 10 mais lucrativos
          'top_lucrativos', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT CONCAT(fah.origin_city, ' → ', fah.destination_city) as rota,
                     fah.distance_km as km,
                     fah.agreed_price as receita,
                     CASE WHEN fah.distance_km > 0 THEN ROUND((fah.agreed_price / fah.distance_km)::numeric, 2) ELSE 0 END as rs_km
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND fah.distance_km > 0 AND fah.agreed_price > 0
              ORDER BY rs_km DESC LIMIT 10
            ) t
          ),
          -- Bottom 10 menos lucrativos
          'bottom_lucrativos', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT CONCAT(fah.origin_city, ' → ', fah.destination_city) as rota,
                     fah.distance_km as km,
                     fah.agreed_price as receita,
                     CASE WHEN fah.distance_km > 0 THEN ROUND((fah.agreed_price / fah.distance_km)::numeric, 2) ELSE 0 END as rs_km
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND fah.distance_km > 0 AND fah.agreed_price > 0
              ORDER BY rs_km ASC LIMIT 10
            ) t
          )
        )
      )
    ) INTO v_result;

  WHEN 'TRANSPORTADORA' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'total_fretes', (SELECT COUNT(*) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR fah.cargo_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))),
          'fretes_concluidos', (SELECT COUNT(*) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to),
          'receita_total', COALESCE((SELECT SUM(fah.agreed_price) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'distancia_total_km', COALESCE((SELECT SUM(fah.distance_km) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'total_motoristas', (SELECT COUNT(DISTINCT fah.driver_id) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to),
          'ticket_medio', COALESCE((SELECT AVG(fah.agreed_price) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'rs_por_km', COALESCE((SELECT CASE WHEN SUM(fah.distance_km) > 0 THEN SUM(fah.agreed_price) / SUM(fah.distance_km) ELSE 0 END FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'receita_por_motorista', COALESCE((
            SELECT CASE WHEN COUNT(DISTINCT fah.driver_id) > 0 THEN SUM(fah.agreed_price) / COUNT(DISTINCT fah.driver_id) ELSE 0 END
            FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'receita_por_carreta', COALESCE((SELECT AVG(fah.agreed_price) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'taxa_cancelamento', COALESCE((SELECT CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED')::float / COUNT(*)) * 100 ELSE 0 END FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to), 0),
          'utilizacao_frota', COALESCE((
            SELECT CASE WHEN (SELECT COUNT(*) FROM company_drivers cd WHERE cd.company_id = v_company_id AND cd.status = 'ACTIVE') > 0
              THEN (COUNT(DISTINCT fah.driver_id)::float / (SELECT COUNT(*) FROM company_drivers cd WHERE cd.company_id = v_company_id AND cd.status = 'ACTIVE')) * 100
              ELSE 0 END
            FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
          ), 0),
          'sla_medio_horas', COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (fah.completed_at - fah.created_at)) / 3600) FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to), 0),
          'avaliacao_media', COALESCE((
            SELECT AVG(r.rating) FROM ratings r
            JOIN freight_assignment_history fah ON fah.driver_id = r.rated_id
            WHERE fah.company_id = v_company_id AND r.created_at >= p_date_from AND r.created_at <= p_date_to
          ), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          'receita_por_dia', (SELECT json_agg(row_to_json(t)) FROM (SELECT TO_CHAR(fah.completed_at, 'DD/MM') as dia, COALESCE(SUM(fah.agreed_price), 0) as receita FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to GROUP BY 1, DATE_TRUNC('day', fah.completed_at) ORDER BY DATE_TRUNC('day', fah.completed_at)) t),
          'receita_por_mes', (SELECT json_agg(row_to_json(t)) FROM (SELECT TO_CHAR(DATE_TRUNC('month', fah.completed_at), 'YYYY-MM') as mes, COALESCE(SUM(fah.agreed_price), 0) as receita FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to GROUP BY 1 ORDER BY 1) t),
          'volume_por_dia', (SELECT json_agg(row_to_json(t)) FROM (SELECT TO_CHAR(fah.completed_at, 'DD/MM') as dia, COUNT(*) FILTER (WHERE fah.status_final = 'DELIVERED') as concluidos, COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelados FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to GROUP BY 1, DATE_TRUNC('day', COALESCE(fah.completed_at, fah.created_at)) ORDER BY DATE_TRUNC('day', COALESCE(fah.completed_at, fah.created_at))) t),
          'por_status', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.status_final as name, COUNT(*) as value FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to GROUP BY 1 ORDER BY 2 DESC) t),
          'por_tipo_carga', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.cargo_type as name, COUNT(*) as value, COALESCE(SUM(fah.agreed_price), 0) as receita FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND fah.cargo_type IS NOT NULL GROUP BY 1 ORDER BY receita DESC) t),
          'por_motorista', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT COALESCE(p.full_name, 'Motorista') as motorista,
                     COUNT(*) as viagens,
                     COALESCE(SUM(fah.agreed_price), 0) as receita,
                     COALESCE(SUM(fah.distance_km), 0) as km,
                     CASE WHEN SUM(fah.distance_km) > 0 THEN ROUND((SUM(fah.agreed_price) / SUM(fah.distance_km))::numeric, 2) ELSE 0 END as rs_km,
                     COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelamentos
              FROM freight_assignment_history fah
              JOIN profiles p ON p.id = fah.driver_id
              WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY fah.driver_id, p.full_name ORDER BY receita DESC LIMIT 10
            ) t
          ),
          'top_rotas', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.origin_city as origem, fah.destination_city as destino, COUNT(*) as viagens, COALESCE(SUM(fah.agreed_price), 0) as receita FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED' AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to AND fah.origin_city IS NOT NULL AND fah.destination_city IS NOT NULL GROUP BY 1, 2 ORDER BY receita DESC LIMIT 10) t),
          'por_cidade', (SELECT json_agg(row_to_json(t)) FROM (SELECT fah.origin_city as name, COUNT(*) as value FROM freight_assignment_history fah WHERE fah.company_id = v_company_id AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to AND fah.origin_city IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
        )
      ),
      'tables', (
        SELECT json_build_object(
          'resumo_por_motorista', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT COALESCE(p.full_name, 'Motorista') as motorista,
                     COUNT(*) as viagens,
                     COALESCE(SUM(fah.agreed_price), 0) as receita,
                     COALESCE(SUM(fah.distance_km), 0) as km,
                     CASE WHEN SUM(fah.distance_km) > 0 THEN ROUND((SUM(fah.agreed_price) / SUM(fah.distance_km))::numeric, 2) ELSE 0 END as rs_km,
                     COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelamentos
              FROM freight_assignment_history fah
              JOIN profiles p ON p.id = fah.driver_id
              WHERE fah.company_id = v_company_id
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              GROUP BY fah.driver_id, p.full_name ORDER BY receita DESC
            ) t
          ),
          'resumo_por_rota', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT CONCAT(fah.origin_city, ' → ', fah.destination_city) as rota,
                     COUNT(*) as frequencia,
                     COALESCE(SUM(fah.agreed_price), 0) as receita,
                     COALESCE(AVG(fah.distance_km), 0) as km_medio,
                     CASE WHEN AVG(fah.distance_km) > 0 THEN ROUND((SUM(fah.agreed_price) / SUM(fah.distance_km))::numeric, 2) ELSE 0 END as rs_km
              FROM freight_assignment_history fah
              WHERE fah.company_id = v_company_id AND fah.status_final = 'DELIVERED'
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND fah.origin_city IS NOT NULL AND fah.destination_city IS NOT NULL
              GROUP BY 1 ORDER BY receita DESC LIMIT 20
            ) t
          ),
          'ultimas_operacoes', (
            SELECT json_agg(row_to_json(t)) FROM (
              SELECT fah.completed_at as data,
                     COALESCE(p.full_name, 'Motorista') as motorista,
                     fah.origin_city,
                     fah.destination_city,
                     fah.distance_km as km,
                     fah.agreed_price as receita,
                     fah.status_final
              FROM freight_assignment_history fah
              JOIN profiles p ON p.id = fah.driver_id
              WHERE fah.company_id = v_company_id
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              ORDER BY fah.completed_at DESC NULLS LAST LIMIT 50
            ) t
          )
        )
      )
    ) INTO v_result;

  WHEN 'PRESTADOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'total_servicos', (SELECT COUNT(*) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo)) AND (NOT v_has_status_filter OR srh.status_final = ANY(v_filter_status))),
          'servicos_concluidos', (SELECT COUNT(*) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))),
          'servicos_cancelados', (SELECT COUNT(*) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'CANCELLED' AND srh.cancelled_at >= p_date_from AND srh.cancelled_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))),
          'servicos_em_andamento', 0,
          'receita_total', COALESCE((SELECT SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))), 0),
          'ticket_medio', COALESCE((SELECT AVG(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to), 0),
          'avaliacao_media', COALESCE((SELECT AVG(r.rating) FROM ratings r WHERE r.rated_id = p_profile_id AND r.created_at >= p_date_from AND r.created_at <= p_date_to), 0),
          'total_avaliacoes', COALESCE((SELECT COUNT(*) FROM ratings r WHERE r.rated_id = p_profile_id AND r.created_at >= p_date_from AND r.created_at <= p_date_to), 0)
        )
      ),
      'charts', (
        SELECT json_build_object(
          'receita_por_mes', (SELECT json_agg(row_to_json(t)) FROM (SELECT TO_CHAR(DATE_TRUNC('month', srh.completed_at), 'YYYY-MM') as mes, COALESCE(SUM(COALESCE(srh.final_price, srh.estimated_price, 0)), 0) as receita FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to GROUP BY 1 ORDER BY 1) t),
          'por_status', (SELECT json_agg(row_to_json(t)) FROM (SELECT srh.status_final as name, COUNT(*) as value FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to GROUP BY 1 ORDER BY 2 DESC) t),
          'por_tipo_servico', (SELECT json_agg(row_to_json(t)) FROM (SELECT srh.service_type as name, COUNT(*) as value FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to GROUP BY 1 ORDER BY 2 DESC) t),
          'volume_por_dia', (SELECT json_agg(row_to_json(t)) FROM (SELECT TO_CHAR(srh.completed_at, 'DD/MM') as dia, COUNT(*) as concluidos, 0 as cancelados FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to GROUP BY 1, DATE_TRUNC('day', srh.completed_at) ORDER BY DATE_TRUNC('day', srh.completed_at)) t),
          'por_cidade', (SELECT json_agg(row_to_json(t)) FROM (SELECT srh.city as name, COUNT(*) as value FROM service_request_history srh WHERE srh.provider_id = p_profile_id AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to AND srh.city IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8) t)
        )
      ),
      'tables', '[]'::json
    ) INTO v_result;

  ELSE
    v_result := '{}'::json;
  END CASE;

  RETURN v_result;
END;
$$;
