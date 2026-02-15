
-- Fix get_reports_dashboard PRESTADOR panel:
-- 1. total_servicos now counts ALL services (not just completed)
-- 2. servicos_cancelados uses cancelled_at instead of completed_at
-- 3. Charts use COALESCE dates to include cancelled services
-- 4. Use COALESCE(final_price, estimated_price, 0) for revenue calculations
-- 5. Add servicos_em_andamento KPI
-- 6. Add volume_por_dia chart for PRESTADOR
-- 7. Better date filtering for all queries

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
  -- PAINEL MOTORISTA (unchanged from previous fix)
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
            SELECT SUM(fh.distance_km)
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
          )
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
        'top_rotas', (
          SELECT COALESCE(json_agg(r), '[]'::json) FROM (
            SELECT fh.origin_city as origem, fh.destination_city as destino, 
                   COUNT(*) as total, SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY fh.origin_city, fh.destination_city ORDER BY total DESC LIMIT 5
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
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT fh.freight_id as id, fh.origin_city, fh.destination_city, 
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   fah.status_final, fah.completed_at as data, fh.cargo_type, 'FRETE' as tipo
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
            UNION ALL
            SELECT srh.id, srh.city as origin_city, srh.city as destination_city,
                   COALESCE(srh.final_price, srh.estimated_price, 0) as receita,
                   srh.status_final, COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) as data, srh.service_type as cargo_type, 'SERVICO' as tipo
            FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) >= p_date_from 
              AND COALESCE(srh.completed_at, srh.cancelled_at, srh.created_at) <= p_date_to
            ORDER BY data DESC LIMIT 20
          ) op
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL TRANSPORTADORA (unchanged)
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
          )
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
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY p.full_name ORDER BY viagens DESC LIMIT 10
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
            GROUP BY fh.origin_city, fh.destination_city ORDER BY total DESC LIMIT 5
          ) r
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT fh.freight_id, fh.origin_city, fh.destination_city, 
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   fah.status_final, fah.completed_at as data, fh.cargo_type,
                   p.full_name as motorista
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
            ORDER BY data DESC LIMIT 20
          ) op
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL PRESTADOR (FIXED: proper date filtering, price fallback, all services counted)
  -- =====================================================
  WHEN 'PRESTADOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          -- Receita total (COMPLETED only, with price fallback)
          'receita_total', COALESCE((
            SELECT SUM(COALESCE(final_price, estimated_price, 0)) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0),
          -- Concluídos
          'servicos_concluidos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ),
          -- Total de serviços (ALL statuses, using COALESCE date)
          'total_servicos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
          ),
          -- Avaliação média
          'avaliacao_media', COALESCE((
            SELECT AVG(sr.rating) FROM service_ratings sr 
            WHERE sr.rated_user_id = p_profile_id AND sr.created_at >= p_date_from AND sr.created_at <= p_date_to
          ), 0),
          -- Total avaliações
          'total_avaliacoes', (
            SELECT COUNT(*) FROM service_ratings sr 
            WHERE sr.rated_user_id = p_profile_id AND sr.created_at >= p_date_from AND sr.created_at <= p_date_to
          ),
          -- Ticket médio (with price fallback)
          'ticket_medio', COALESCE((
            SELECT AVG(COALESCE(final_price, estimated_price, 0)) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0),
          -- FIX: Cancelados usa cancelled_at (não completed_at)
          'servicos_cancelados', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'CANCELLED' 
              AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
          ),
          -- NEW: Em andamento (serviços ativos na tabela principal)
          'servicos_em_andamento', (
            SELECT COUNT(*) FROM service_requests
            WHERE provider_id = p_profile_id AND status IN ('ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
          )
        )
      ),
      'charts', json_build_object(
        -- Receita por mês
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(completed_at, 'YYYY-MM') as mes, SUM(COALESCE(final_price, estimated_price, 0)) as receita
            FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        -- Por tipo de serviço (ALL statuses)
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
        -- Por cidade (ALL statuses)
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
        -- Por status (ALL statuses with COALESCE date)
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
        -- NEW: Volume por dia (para PRESTADOR)
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
        -- Lista de serviços (ALL statuses)
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
