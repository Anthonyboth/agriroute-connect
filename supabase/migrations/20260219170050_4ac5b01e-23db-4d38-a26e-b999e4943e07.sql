
-- Expand get_reports_dashboard: Add filter support (tipo, status_final, uf, motoristas)
-- Add missing KPIs: utilização da frota (TRANSPORTADORA), SLA operacional, receita por carreta
-- Filters are passed via p_filters jsonb parameter

CREATE OR REPLACE FUNCTION public.get_reports_dashboard(
  p_panel text DEFAULT 'PRODUTOR',
  p_profile_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT (now() - interval '30 days'),
  p_date_to timestamptz DEFAULT now(),
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS JSON
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
  -- Autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Parse filters
  v_filter_tipo := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'tipo', '[]'::jsonb)));
  v_filter_status := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_filters->'status_final', '[]'::jsonb)));
  v_filter_uf := p_filters->>'uf';
  v_filter_motoristas := ARRAY(SELECT (jsonb_array_elements_text(COALESCE(p_filters->'motoristas', '[]'::jsonb)))::uuid);
  
  v_has_tipo_filter := array_length(v_filter_tipo, 1) IS NOT NULL;
  v_has_status_filter := array_length(v_filter_status, 1) IS NOT NULL;
  v_has_uf_filter := v_filter_uf IS NOT NULL AND v_filter_uf != '';
  v_has_motoristas_filter := array_length(v_filter_motoristas, 1) IS NOT NULL;

  -- Verificar que o profile pertence ao usuário autenticado
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
  -- =====================================================
  -- PAINEL PRODUTOR
  -- =====================================================
  WHEN 'PRODUTOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'freights_total', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
            AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
            AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)),
          'freights_completed', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
            AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)),
          'freights_cancelled', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND status_final = 'CANCELLED' AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
            AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
            AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)),
          'freights_total_value', COALESCE((SELECT SUM(price_total) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
            AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
            AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))),
          'services_completed', (SELECT COUNT(*) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))),
          'services_total_value', COALESCE((SELECT SUM(COALESCE(final_price, estimated_price, 0)) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))), 0),
          'ticket_medio_frete', COALESCE((SELECT AVG(price_total) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
            AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)), 0),
          'ticket_medio_servico', COALESCE((SELECT AVG(COALESCE(final_price, estimated_price, 0)) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))), 0)
        )
      ),
      'charts', json_build_object(
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(fretes) as fretes, SUM(servicos) as servicos, SUM(fretes + servicos) as total FROM (
              SELECT date_trunc('day', completed_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', cancelled_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final = 'CANCELLED' AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
                AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', COALESCE(completed_at, cancelled_at, created_at))::date as dia, 0 as fretes, COUNT(*) as servicos
              FROM service_request_history 
              WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
                AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'valor_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(valor_fretes) as valor_fretes, SUM(valor_servicos) as valor_servicos, SUM(valor_fretes + valor_servicos) as total FROM (
              SELECT date_trunc('day', completed_at)::date as dia, SUM(price_total) as valor_fretes, 0 as valor_servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', completed_at)::date as dia, 0 as valor_fretes, SUM(COALESCE(final_price, estimated_price, 0)) as valor_servicos
              FROM service_request_history 
              WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'por_status_frete', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
            GROUP BY status_final
          ) s
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT cargo_type as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
            GROUP BY cargo_type ORDER BY value DESC LIMIT 10
          ) c
        ),
        'top_destinos', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT destination_city as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to AND destination_city IS NOT NULL
              AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
            GROUP BY destination_city ORDER BY value DESC LIMIT 5
          ) d
        ),
        'por_tipo_servico', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT service_type as name, COUNT(*) as value
            FROM service_request_history WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
            GROUP BY service_type ORDER BY value DESC LIMIT 10
          ) t
        )
      ),
      'tables', json_build_object(
        'ultimos_fretes', (
          SELECT COALESCE(json_agg(f ORDER BY f.data DESC), '[]'::json) FROM (
            SELECT freight_id, origin_city, destination_city, price_total, status_final, completed_at as data, cargo_type
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR origin_state = v_filter_uf OR destination_state = v_filter_uf)
            ORDER BY data DESC LIMIT 20
          ) f
        ),
        'ultimos_servicos', (
          SELECT COALESCE(json_agg(s ORDER BY s.data DESC), '[]'::json) FROM (
            SELECT id, service_type, city, COALESCE(final_price, estimated_price, 0) as final_price, status_final, COALESCE(completed_at, cancelled_at, created_at) as data
            FROM service_request_history WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
            ORDER BY data DESC LIMIT 20
          ) s
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL MOTORISTA (with filters + missing KPIs)
  -- =====================================================
  WHEN 'MOTORISTA' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'receita_total', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'fretes_concluidos', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ),
          'total_fretes', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ),
          'avaliacao_media', COALESCE((
            SELECT AVG(fr.rating) FROM freight_ratings fr 
            WHERE fr.rated_user_id = p_profile_id AND fr.created_at >= p_date_from AND fr.created_at <= p_date_to
          ), 0),
          'total_avaliacoes', (
            SELECT COUNT(*) FROM freight_ratings fr 
            WHERE fr.rated_user_id = p_profile_id AND fr.created_at >= p_date_from AND fr.created_at <= p_date_to
          ),
          'ticket_medio', COALESCE((
            SELECT AVG(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'distancia_total_km', COALESCE((
            SELECT SUM(COALESCE(fah.distance_km, fh.distance_km))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'despesas_total', COALESCE((
            SELECT SUM(de.amount) FROM driver_expenses de
            WHERE de.driver_id = p_profile_id AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
          ), 0),
          'servicos_receita', COALESCE((
            SELECT SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' 
              AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
          ), 0),
          'servicos_total', (
            SELECT COUNT(*) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id 
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
          ),
          'rs_por_km', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) / NULLIF(SUM(COALESCE(fah.distance_km, fh.distance_km)), 0)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'rs_por_ton', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) / NULLIF(SUM(COALESCE(fah.weight_per_truck, fh.weight)), 0)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'km_medio_viagem', COALESCE((
            SELECT AVG(COALESCE(fah.distance_km, fh.distance_km))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'taxa_cancelamento', COALESCE((
            SELECT (COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED')::numeric / NULLIF(COUNT(*), 0) * 100)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0),
          'tempo_medio_ciclo_horas', COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (fa.delivered_at - fa.accepted_at)) / 3600)
            FROM freight_assignments fa
            WHERE fa.driver_id = p_profile_id AND fa.status = 'DELIVERED'
              AND fa.delivered_at >= p_date_from AND fa.delivered_at <= p_date_to
              AND fa.delivered_at IS NOT NULL AND fa.accepted_at IS NOT NULL
          ), 0),
          'peso_total', COALESCE((
            SELECT SUM(COALESCE(fah.weight_per_truck, fh.weight))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
          ), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT mes, SUM(receita) as receita FROM (
              SELECT to_char(fah.completed_at, 'YYYY-MM') as mes, 
                     SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              GROUP BY 1
              UNION ALL
              SELECT to_char(srh.completed_at, 'YYYY-MM') as mes,
                     SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) as receita
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED'
                AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
              GROUP BY 1
            ) combined
            GROUP BY mes
          ) d
        ),
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(fretes) as fretes, SUM(servicos) as servicos FROM (
              SELECT date_trunc('day', fah.completed_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED')
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at))::date as dia, 0 as fretes, COUNT(*) as servicos
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
                AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'km_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', fah.completed_at)::date as dia, 
                   SUM(COALESCE(fah.distance_km, fh.distance_km, 0)) as km
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            GROUP BY 1
          ) d
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT name, SUM(value) as value FROM (
              SELECT fh.cargo_type as name, COUNT(*) as value
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.driver_id = p_profile_id 
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
                AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
                AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              GROUP BY fh.cargo_type
              UNION ALL
              SELECT srh.service_type as name, COUNT(*) as value
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
                AND (NOT v_has_status_filter OR srh.status_final = ANY(v_filter_status))
              GROUP BY srh.service_type
            ) combined
            GROUP BY name
            ORDER BY value DESC LIMIT 10
          ) c
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            GROUP BY fah.status_final
          ) s
        ),
        'top_rotas', (
          SELECT COALESCE(json_agg(r), '[]'::json) FROM (
            SELECT fh.origin_city as origem, fh.destination_city as destino, 
                   COUNT(*) as total, SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            GROUP BY fh.origin_city, fh.destination_city ORDER BY receita DESC LIMIT 8
          ) r
        ),
        'despesas_por_tipo', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT de.expense_type as name, SUM(de.amount) as value
            FROM driver_expenses de
            WHERE de.driver_id = p_profile_id 
              AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
            GROUP BY de.expense_type ORDER BY value DESC LIMIT 10
          ) d
        ),
        'despesas_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(de.expense_date, 'YYYY-MM') as mes, SUM(de.amount) as despesas
            FROM driver_expenses de
            WHERE de.driver_id = p_profile_id 
              AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
            GROUP BY 1
          ) d
        ),
        'scatter_rs_km', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT COALESCE(fah.distance_km, fh.distance_km, 0) as km,
                   COALESCE(fah.agreed_price, fh.price_total, 0) as receita,
                   CASE WHEN COALESCE(fah.distance_km, fh.distance_km, 0) > 0 
                        THEN COALESCE(fah.agreed_price, fh.price_total, 0) / COALESCE(fah.distance_km, fh.distance_km, 1)
                        ELSE 0 END as rs_km,
                   fh.origin_city || ' → ' || fh.destination_city as rota
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND COALESCE(fah.distance_km, fh.distance_km, 0) > 0
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            ORDER BY fah.completed_at DESC LIMIT 50
          ) d
        ),
        'avaliacoes_distribuicao', (
          SELECT COALESCE(json_agg(a ORDER BY a.stars), '[]'::json) FROM (
            SELECT fr.rating as stars, fr.rating::text as name, COUNT(*) as value
            FROM freight_ratings fr
            WHERE fr.rated_user_id = p_profile_id AND fr.created_at >= p_date_from AND fr.created_at <= p_date_to
            GROUP BY fr.rating
          ) a
        ),
        'avaliacoes_trend', (
          SELECT COALESCE(json_agg(a ORDER BY a.mes), '[]'::json) FROM (
            SELECT to_char(fr.created_at, 'YYYY-MM') as mes, AVG(fr.rating) as media, COUNT(*) as total
            FROM freight_ratings fr
            WHERE fr.rated_user_id = p_profile_id AND fr.created_at >= p_date_from AND fr.created_at <= p_date_to
            GROUP BY 1
          ) a
        ),
        'receita_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(receita) as receita FROM (
              SELECT date_trunc('day', fah.completed_at)::date as dia, 
                     SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED')
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', srh.completed_at)::date as dia,
                     SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) as receita
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED'
                AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        )
      ),
      'tables', json_build_object(
        'extrato_ganhos', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT fh.freight_id as id, fh.origin_city, fh.destination_city, 
                   COALESCE(fah.distance_km, fh.distance_km, 0) as km,
                   COALESCE(fah.weight_per_truck, fh.weight, 0) as peso,
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   fah.status_final, fah.completed_at as data, fh.cargo_type, 'FRETE' as tipo,
                   CASE WHEN COALESCE(fah.distance_km, fh.distance_km, 0) > 0 
                        THEN ROUND((COALESCE(fah.agreed_price, fh.price_total) / COALESCE(fah.distance_km, fh.distance_km, 1))::numeric, 2)
                        ELSE 0 END as rs_km
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            UNION ALL
            SELECT srh.id, srh.city as origin_city, srh.city as destination_city,
                   0 as km, 0 as peso,
                   COALESCE(srh.final_price, srh.estimated_price, 0) as receita,
                   srh.status_final, COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) as data, 
                   srh.service_type as cargo_type, 'SERVICO' as tipo, 0 as rs_km
            FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR srh.service_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR srh.status_final = ANY(v_filter_status))
            ORDER BY data DESC LIMIT 50
          ) op
        ),
        'top_lucrativos', (
          SELECT COALESCE(json_agg(op ORDER BY op.rs_km DESC), '[]'::json) FROM (
            SELECT fh.origin_city || ' → ' || fh.destination_city as rota,
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   COALESCE(fah.distance_km, fh.distance_km, 0) as km,
                   ROUND((COALESCE(fah.agreed_price, fh.price_total) / NULLIF(COALESCE(fah.distance_km, fh.distance_km), 0))::numeric, 2) as rs_km,
                   fah.completed_at as data
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND COALESCE(fah.distance_km, fh.distance_km, 0) > 0
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            ORDER BY rs_km DESC LIMIT 10
          ) op
        ),
        'bottom_lucrativos', (
          SELECT COALESCE(json_agg(op ORDER BY op.rs_km ASC), '[]'::json) FROM (
            SELECT fh.origin_city || ' → ' || fh.destination_city as rota,
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   COALESCE(fah.distance_km, fh.distance_km, 0) as km,
                   ROUND((COALESCE(fah.agreed_price, fh.price_total) / NULLIF(COALESCE(fah.distance_km, fh.distance_km), 0))::numeric, 2) as rs_km,
                   fah.completed_at as data
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND COALESCE(fah.distance_km, fh.distance_km, 0) > 0
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
            ORDER BY rs_km ASC LIMIT 10
          ) op
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL TRANSPORTADORA (with filters + missing KPIs)
  -- =====================================================
  WHEN 'TRANSPORTADORA' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'receita_total', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ), 0),
          'fretes_concluidos', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ),
          'total_fretes', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ),
          'ticket_medio', COALESCE((
            SELECT AVG(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ), 0),
          'total_motoristas', (
            SELECT COUNT(DISTINCT fah.driver_id)
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ),
          'distancia_total_km', COALESCE((
            SELECT SUM(COALESCE(fah.distance_km, fh.distance_km))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ), 0),
          'receita_por_motorista', COALESCE((
            SELECT AVG(receita_mot) FROM (
              SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita_mot
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
                AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
              GROUP BY fah.driver_id
            ) sub
          ), 0),
          'taxa_cancelamento', COALESCE((
            SELECT (COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED')::numeric / NULLIF(COUNT(*), 0) * 100)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ), 0),
          'rs_por_km', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) / NULLIF(SUM(COALESCE(fah.distance_km, fh.distance_km)), 0)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ), 0),
          'avaliacao_media', COALESCE((
            SELECT AVG(fr.rating) FROM freight_ratings fr
            JOIN freight_assignment_history fah ON fah.driver_id = fr.rated_user_id 
              AND fah.company_id = v_company_id
            WHERE fr.created_at >= p_date_from AND fr.created_at <= p_date_to
          ), 0),
          -- NEW: Utilização da frota (% motoristas com >= 1 operação)
          'utilizacao_frota', COALESCE((
            SELECT (COUNT(DISTINCT fah.driver_id)::numeric / NULLIF((
              SELECT COUNT(DISTINCT cd.driver_profile_id) 
              FROM company_drivers cd 
              WHERE cd.company_id = v_company_id AND cd.status = 'active'
            ), 0) * 100)
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          -- NEW: Receita por carreta (assignment)
          'receita_por_carreta', COALESCE((
            SELECT AVG(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
          ), 0),
          -- NEW: SLA médio (horas do aceite até entrega)
          'sla_medio_horas', COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (fa.delivered_at - fa.accepted_at)) / 3600)
            FROM freight_assignments fa
            WHERE fa.company_id = v_company_id AND fa.status = 'DELIVERED'
              AND fa.delivered_at >= p_date_from AND fa.delivered_at <= p_date_to
              AND fa.delivered_at IS NOT NULL AND fa.accepted_at IS NOT NULL
          ), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(fah.completed_at, 'YYYY-MM') as mes, SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY 1
          ) d
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT fah.status_final as name, COUNT(*) as value
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY fah.status_final
          ) s
        ),
        'por_motorista', (
          SELECT COALESCE(json_agg(m), '[]'::json) FROM (
            SELECT p.full_name as motorista, COUNT(*) as viagens, 
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita,
                   SUM(COALESCE(fah.distance_km, fh.distance_km, 0)) as km,
                   CASE WHEN SUM(COALESCE(fah.distance_km, fh.distance_km, 0)) > 0 
                        THEN ROUND((SUM(COALESCE(fah.agreed_price, fh.price_total)) / SUM(COALESCE(fah.distance_km, fh.distance_km, 1)))::numeric, 2)
                        ELSE 0 END as rs_km,
                   COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelamentos
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY p.full_name ORDER BY receita DESC LIMIT 15
          ) m
        ),
        'top_rotas', (
          SELECT COALESCE(json_agg(r), '[]'::json) FROM (
            SELECT fh.origin_city as origem, fh.destination_city as destino, 
                   COUNT(*) as total, SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY fh.origin_city, fh.destination_city ORDER BY receita DESC LIMIT 8
          ) r
        ),
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', COALESCE(fah.completed_at, fah.created_at))::date as dia, 
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE fah.status_final IN ('COMPLETED','DELIVERED')) as concluidos,
                   COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelados
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY 1
          ) d
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT fh.cargo_type as name, COUNT(*) as value, SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY fh.cargo_type ORDER BY receita DESC LIMIT 10
          ) c
        ),
        'por_cidade', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT city as name, COUNT(*) as value FROM (
              SELECT fh.origin_city as city FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.company_id = v_company_id 
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
                AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
              UNION ALL
              SELECT fh.destination_city as city FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.company_id = v_company_id 
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
                AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
                AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            ) cities
            WHERE city IS NOT NULL
            GROUP BY city ORDER BY value DESC LIMIT 8
          ) c
        ),
        'receita_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', fah.completed_at)::date as dia, 
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY 1
          ) d
        )
      ),
      'tables', json_build_object(
        'resumo_por_motorista', (
          SELECT COALESCE(json_agg(m ORDER BY m.receita DESC), '[]'::json) FROM (
            SELECT p.full_name as motorista, 
                   COUNT(*) FILTER (WHERE fah.status_final IN ('COMPLETED','DELIVERED')) as viagens,
                   SUM(CASE WHEN fah.status_final IN ('COMPLETED','DELIVERED') THEN COALESCE(fah.agreed_price, fh.price_total) ELSE 0 END) as receita,
                   SUM(CASE WHEN fah.status_final IN ('COMPLETED','DELIVERED') THEN COALESCE(fah.distance_km, fh.distance_km, 0) ELSE 0 END) as km,
                   CASE WHEN SUM(CASE WHEN fah.status_final IN ('COMPLETED','DELIVERED') THEN COALESCE(fah.distance_km, fh.distance_km, 0) ELSE 0 END) > 0
                        THEN ROUND((SUM(CASE WHEN fah.status_final IN ('COMPLETED','DELIVERED') THEN COALESCE(fah.agreed_price, fh.price_total) ELSE 0 END) / 
                                    SUM(CASE WHEN fah.status_final IN ('COMPLETED','DELIVERED') THEN COALESCE(fah.distance_km, fh.distance_km, 1) ELSE 1 END))::numeric, 2)
                        ELSE 0 END as rs_km,
                   COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelamentos,
                   COUNT(*) as total_ops
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY p.full_name
          ) m
        ),
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT fh.freight_id, fh.origin_city, fh.destination_city, 
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   fah.status_final, fah.completed_at as data, fh.cargo_type,
                   p.full_name as motorista,
                   COALESCE(fah.distance_km, fh.distance_km, 0) as km
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR fah.status_final = ANY(v_filter_status))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            ORDER BY data DESC LIMIT 30
          ) op
        ),
        'resumo_por_rota', (
          SELECT COALESCE(json_agg(r ORDER BY r.receita DESC), '[]'::json) FROM (
            SELECT fh.origin_city || ' → ' || fh.destination_city as rota,
                   COUNT(*) as frequencia,
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita,
                   ROUND(AVG(COALESCE(fah.distance_km, fh.distance_km, 0))::numeric, 0) as km_medio,
                   CASE WHEN AVG(COALESCE(fah.distance_km, fh.distance_km, 0)) > 0
                        THEN ROUND((SUM(COALESCE(fah.agreed_price, fh.price_total)) / SUM(COALESCE(fah.distance_km, fh.distance_km, 1)))::numeric, 2)
                        ELSE 0 END as rs_km
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR fh.cargo_type = ANY(v_filter_tipo))
              AND (NOT v_has_uf_filter OR fh.origin_state = v_filter_uf OR fh.destination_state = v_filter_uf)
              AND (NOT v_has_motoristas_filter OR fah.driver_id = ANY(v_filter_motoristas))
            GROUP BY fh.origin_city, fh.destination_city
            ORDER BY receita DESC LIMIT 15
          ) r
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL PRESTADOR (with filters)
  -- =====================================================
  WHEN 'PRESTADOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'receita_total', COALESCE((
            SELECT SUM(COALESCE(final_price, estimated_price, 0)) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
          ), 0),
          'servicos_concluidos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
          ),
          'total_servicos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
          ),
          'avaliacao_media', COALESCE((
            SELECT AVG(sr.rating) FROM service_ratings sr 
            WHERE sr.rated_user_id = p_profile_id AND sr.created_at >= p_date_from AND sr.created_at <= p_date_to
          ), 0),
          'total_avaliacoes', (
            SELECT COUNT(*) FROM service_ratings sr 
            WHERE sr.rated_user_id = p_profile_id AND sr.created_at >= p_date_from AND sr.created_at <= p_date_to
          ),
          'ticket_medio', COALESCE((
            SELECT AVG(COALESCE(final_price, estimated_price, 0)) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
          ), 0),
          'servicos_cancelados', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'CANCELLED' 
              AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
          ),
          'servicos_em_andamento', (
            SELECT COUNT(*) FROM service_requests
            WHERE provider_id = p_profile_id AND status IN ('ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
          )
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(completed_at, 'YYYY-MM') as mes, SUM(COALESCE(final_price, estimated_price, 0)) as receita
            FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
            GROUP BY 1
          ) d
        ),
        'por_tipo_servico', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT service_type as name, COUNT(*) as value
            FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
            GROUP BY service_type ORDER BY value DESC LIMIT 10
          ) t
        ),
        'por_cidade', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT city as name, COUNT(*) as value
            FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND city IS NOT NULL
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
            GROUP BY city ORDER BY value DESC LIMIT 5
          ) c
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
            GROUP BY status_final
          ) s
        ),
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', COALESCE(completed_at, cancelled_at, created_at))::date as dia, 
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE status_final = 'COMPLETED') as concluidos,
                   COUNT(*) FILTER (WHERE status_final = 'CANCELLED') as cancelados
            FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
            GROUP BY 1
          ) d
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT id, service_type, city, COALESCE(final_price, estimated_price, 0) as final_price, 
                   status_final, COALESCE(completed_at, cancelled_at, created_at) as data,
                   contact_name as cliente
            FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              AND (NOT v_has_tipo_filter OR service_type = ANY(v_filter_tipo))
              AND (NOT v_has_status_filter OR status_final = ANY(v_filter_status))
            ORDER BY data DESC LIMIT 30
          ) op
        )
      )
    ) INTO v_result;

  ELSE
    RAISE EXCEPTION 'Painel inválido: %', p_panel;
  END CASE;

  RETURN v_result;
END;
$$;
