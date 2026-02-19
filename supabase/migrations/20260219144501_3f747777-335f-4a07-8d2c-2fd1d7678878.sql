
-- Expand get_reports_dashboard: Add comprehensive KPIs and charts for MOTORISTA and TRANSPORTADORA
-- MOTORISTA additions: R$/km, R$/ton, taxa_cancelamento, volume_por_dia, despesas_por_mes, scatter data, avaliacoes
-- TRANSPORTADORA additions: distancia_total, receita/motorista, taxa_cancelamento, avaliação, volume_por_dia, por_tipo_carga, resumo_por_motorista

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
BEGIN
  -- Autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verificar que o profile pertence ao usuário autenticado (exceto TRANSPORTADORA que usa company_id)
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
  -- PAINEL PRODUTOR (unchanged)
  -- =====================================================
  WHEN 'PRODUTOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'freights_total', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to),
          'freights_completed', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'freights_cancelled', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND status_final = 'CANCELLED' AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to),
          'freights_total_value', COALESCE((SELECT SUM(price_total) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to),
          'services_completed', (SELECT COUNT(*) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_total_value', COALESCE((SELECT SUM(COALESCE(final_price, estimated_price, 0)) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'ticket_medio_frete', COALESCE((SELECT AVG(price_total) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'ticket_medio_servico', COALESCE((SELECT AVG(COALESCE(final_price, estimated_price, 0)) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0)
        )
      ),
      'charts', json_build_object(
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(fretes) as fretes, SUM(servicos) as servicos, SUM(fretes + servicos) as total FROM (
              SELECT date_trunc('day', completed_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', cancelled_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final = 'CANCELLED' AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', COALESCE(completed_at, cancelled_at, created_at))::date as dia, 0 as fretes, COUNT(*) as servicos
              FROM service_request_history 
              WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
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
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', completed_at)::date as dia, 0 as valor_fretes, SUM(COALESCE(final_price, estimated_price, 0)) as valor_servicos
              FROM service_request_history 
              WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'por_status_frete', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            GROUP BY status_final
          ) s
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT cargo_type as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            GROUP BY cargo_type ORDER BY value DESC LIMIT 10
          ) c
        ),
        'top_destinos', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT destination_city as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to AND destination_city IS NOT NULL
            GROUP BY destination_city ORDER BY value DESC LIMIT 5
          ) d
        ),
        'por_tipo_servico', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT service_type as name, COUNT(*) as value
            FROM service_request_history WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            GROUP BY service_type ORDER BY value DESC LIMIT 10
          ) t
        )
      ),
      'tables', json_build_object(
        'ultimos_fretes', (
          SELECT COALESCE(json_agg(f ORDER BY f.data DESC), '[]'::json) FROM (
            SELECT freight_id, origin_city, destination_city, price_total, status_final, completed_at as data, cargo_type
            FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            ORDER BY data DESC LIMIT 20
          ) f
        ),
        'ultimos_servicos', (
          SELECT COALESCE(json_agg(s ORDER BY s.data DESC), '[]'::json) FROM (
            SELECT id, service_type, city, COALESCE(final_price, estimated_price, 0) as final_price, status_final, COALESCE(completed_at, cancelled_at, created_at) as data
            FROM service_request_history WHERE client_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            ORDER BY data DESC LIMIT 20
          ) s
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL MOTORISTA (EXPANDED: new KPIs, charts, tables)
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
          ), 0),
          'fretes_concluidos', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ),
          'total_fretes', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
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
          ), 0),
          'distancia_total_km', COALESCE((
            SELECT SUM(COALESCE(fah.distance_km, fh.distance_km))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'despesas_total', COALESCE((
            SELECT SUM(de.amount) FROM driver_expenses de
            WHERE de.driver_id = p_profile_id AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
          ), 0),
          'servicos_receita', COALESCE((
            SELECT SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' 
              AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
          ), 0),
          'servicos_total', (
            SELECT COUNT(*) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id 
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
          ),
          -- NEW: R$/km médio
          'rs_por_km', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) / NULLIF(SUM(COALESCE(fah.distance_km, fh.distance_km)), 0)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          -- NEW: R$/ton médio
          'rs_por_ton', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) / NULLIF(SUM(COALESCE(fah.weight_per_truck, fh.weight)), 0)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          -- NEW: Km médio por viagem
          'km_medio_viagem', COALESCE((
            SELECT AVG(COALESCE(fah.distance_km, fh.distance_km))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          -- NEW: Taxa de cancelamento
          'taxa_cancelamento', COALESCE((
            SELECT (COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED')::numeric / NULLIF(COUNT(*), 0) * 100)
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
          ), 0),
          -- NEW: Tempo médio de ciclo (horas) - da aceitação até conclusão
          'tempo_medio_ciclo_horas', COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (fa.delivered_at - fa.accepted_at)) / 3600)
            FROM freight_assignments fa
            WHERE fa.driver_id = p_profile_id AND fa.status = 'DELIVERED'
              AND fa.delivered_at >= p_date_from AND fa.delivered_at <= p_date_to
              AND fa.delivered_at IS NOT NULL AND fa.accepted_at IS NOT NULL
          ), 0),
          -- NEW: Peso total transportado
          'peso_total', COALESCE((
            SELECT SUM(COALESCE(fah.weight_per_truck, fh.weight))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
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
              GROUP BY 1
              UNION ALL
              SELECT to_char(srh.completed_at, 'YYYY-MM') as mes,
                     SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) as receita
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED'
                AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY mes
          ) d
        ),
        -- NEW: Volume por dia (fretes + serviços)
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(fretes) as fretes, SUM(servicos) as servicos FROM (
              SELECT date_trunc('day', fah.completed_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_assignment_history fah
              WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED')
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at))::date as dia, 0 as fretes, COUNT(*) as servicos
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        -- NEW: Km rodados por dia
        'km_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', fah.completed_at)::date as dia, 
                   SUM(COALESCE(fah.distance_km, fh.distance_km, 0)) as km
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
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
              GROUP BY fh.cargo_type
              UNION ALL
              SELECT srh.service_type as name, COUNT(*) as value
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
                AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
              GROUP BY srh.service_type
            ) combined
            GROUP BY name
            ORDER BY value DESC LIMIT 10
          ) c
        ),
        -- NEW: Por status (pizza)
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
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
        -- NEW: Despesas por mês (para gráfico receita vs despesas)
        'despesas_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(de.expense_date, 'YYYY-MM') as mes, SUM(de.amount) as despesas
            FROM driver_expenses de
            WHERE de.driver_id = p_profile_id 
              AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
            GROUP BY 1
          ) d
        ),
        -- NEW: Scatter R$/km vs distância (cada frete individual)
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
            ORDER BY fah.completed_at DESC LIMIT 50
          ) d
        ),
        -- NEW: Avaliações distribuição
        'avaliacoes_distribuicao', (
          SELECT COALESCE(json_agg(a ORDER BY a.stars), '[]'::json) FROM (
            SELECT fr.rating as stars, fr.rating::text as name, COUNT(*) as value
            FROM freight_ratings fr
            WHERE fr.rated_user_id = p_profile_id AND fr.created_at >= p_date_from AND fr.created_at <= p_date_to
            GROUP BY fr.rating
          ) a
        ),
        -- NEW: Avaliações trend por mês
        'avaliacoes_trend', (
          SELECT COALESCE(json_agg(a ORDER BY a.mes), '[]'::json) FROM (
            SELECT to_char(fr.created_at, 'YYYY-MM') as mes, AVG(fr.rating) as media, COUNT(*) as total
            FROM freight_ratings fr
            WHERE fr.rated_user_id = p_profile_id AND fr.created_at >= p_date_from AND fr.created_at <= p_date_to
            GROUP BY 1
          ) a
        ),
        -- NEW: Receita por dia (linha de faturamento diário)
        'receita_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(receita) as receita FROM (
              SELECT date_trunc('day', fah.completed_at)::date as dia, 
                     SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED')
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', srh.completed_at)::date as dia,
                     SUM(COALESCE(srh.final_price, srh.estimated_price, 0)) as receita
              FROM service_request_history srh
              WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED'
                AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        )
      ),
      'tables', json_build_object(
        -- Extrato de ganhos (detalhado)
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
            ORDER BY data DESC LIMIT 50
          ) op
        ),
        -- Top 10 fretes mais lucrativos
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
            ORDER BY rs_km DESC LIMIT 10
          ) op
        ),
        -- Bottom 10 fretes menos lucrativos
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
            ORDER BY rs_km ASC LIMIT 10
          ) op
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL TRANSPORTADORA (EXPANDED: comprehensive KPIs, charts, tables)
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
          ), 0),
          'fretes_concluidos', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ),
          'total_fretes', (
            SELECT COUNT(*)
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
          ),
          'ticket_medio', COALESCE((
            SELECT AVG(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'total_motoristas', (
            SELECT COUNT(DISTINCT fah.driver_id)
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
          ),
          -- NEW: Distância total da frota
          'distancia_total_km', COALESCE((
            SELECT SUM(COALESCE(fah.distance_km, fh.distance_km))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          -- NEW: Receita por motorista (média)
          'receita_por_motorista', COALESCE((
            SELECT AVG(receita_mot) FROM (
              SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita_mot
              FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              GROUP BY fah.driver_id
            ) sub
          ), 0),
          -- NEW: Taxa de cancelamento
          'taxa_cancelamento', COALESCE((
            SELECT (COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED')::numeric / NULLIF(COUNT(*), 0) * 100)
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
          ), 0),
          -- NEW: R$/km médio da frota
          'rs_por_km', COALESCE((
            SELECT SUM(COALESCE(fah.agreed_price, fh.price_total)) / NULLIF(SUM(COALESCE(fah.distance_km, fh.distance_km)), 0)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          -- NEW: Avaliação média dos motoristas da empresa
          'avaliacao_media', COALESCE((
            SELECT AVG(fr.rating) FROM freight_ratings fr
            JOIN freight_assignment_history fah ON fah.driver_id = fr.rated_user_id 
              AND fah.company_id = v_company_id
            WHERE fr.created_at >= p_date_from AND fr.created_at <= p_date_to
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
            GROUP BY 1
          ) d
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT fah.status_final as name, COUNT(*) as value
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
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
            GROUP BY fh.origin_city, fh.destination_city ORDER BY receita DESC LIMIT 8
          ) r
        ),
        -- NEW: Volume por dia
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', COALESCE(fah.completed_at, fah.created_at))::date as dia, 
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE fah.status_final IN ('COMPLETED','DELIVERED')) as concluidos,
                   COUNT(*) FILTER (WHERE fah.status_final = 'CANCELLED') as cancelados
            FROM freight_assignment_history fah
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
            GROUP BY 1
          ) d
        ),
        -- NEW: Receita por tipo de carga
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT fh.cargo_type as name, COUNT(*) as value, SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY fh.cargo_type ORDER BY receita DESC LIMIT 10
          ) c
        ),
        -- NEW: Cidades com mais operações
        'por_cidade', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT city as name, COUNT(*) as value FROM (
              SELECT fh.origin_city as city FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.company_id = v_company_id 
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
              UNION ALL
              SELECT fh.destination_city as city FROM freight_assignment_history fah
              JOIN freight_history fh ON fh.freight_id = fah.freight_id
              WHERE fah.company_id = v_company_id 
                AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
                AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
            ) cities
            WHERE city IS NOT NULL
            GROUP BY city ORDER BY value DESC LIMIT 8
          ) c
        ),
        -- NEW: Receita por dia
        'receita_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', fah.completed_at)::date as dia, 
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY 1
          ) d
        )
      ),
      'tables', json_build_object(
        -- Resumo por motorista (tabela principal)
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
            GROUP BY p.full_name
          ) m
        ),
        -- Histórico consolidado (últimas operações)
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
            ORDER BY data DESC LIMIT 30
          ) op
        ),
        -- Resumo por rota
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
            GROUP BY fh.origin_city, fh.destination_city
            ORDER BY receita DESC LIMIT 15
          ) r
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL PRESTADOR (unchanged)
  -- =====================================================
  WHEN 'PRESTADOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'receita_total', COALESCE((
            SELECT SUM(COALESCE(final_price, estimated_price, 0)) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0),
          'servicos_concluidos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ),
          'total_servicos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
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
          ), 0),
          'servicos_cancelados', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'CANCELLED' 
              AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
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
