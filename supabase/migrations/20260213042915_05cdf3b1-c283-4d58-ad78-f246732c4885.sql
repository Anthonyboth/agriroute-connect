-- Fix get_reports_dashboard: change to SECURITY DEFINER so it can access profiles table
-- for ownership verification despite column-level security restrictions
CREATE OR REPLACE FUNCTION public.get_reports_dashboard(
  p_panel TEXT,
  p_profile_id UUID,
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_filters JSON DEFAULT '{}'::JSON
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
    -- Para transportadora, p_profile_id é o company_id
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
          'freights_total', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to),
          'freights_completed', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'freights_cancelled', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND status_final = 'CANCELLED' AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to),
          'freights_total_value', COALESCE((SELECT SUM(price_total) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history WHERE client_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_completed', (SELECT COUNT(*) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_total_value', COALESCE((SELECT SUM(final_price) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'ticket_medio_frete', COALESCE((SELECT AVG(price_total) FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'ticket_medio_servico', COALESCE((SELECT AVG(final_price) FROM service_request_history WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0)
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
              SELECT date_trunc('day', completed_at)::date as dia, 0 as fretes, COUNT(*) as servicos
              FROM service_request_history 
              WHERE client_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'valor_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(valor) as valor FROM (
              SELECT date_trunc('day', completed_at)::date as dia, SUM(price_total) as valor
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', completed_at)::date as dia, SUM(final_price) as valor
              FROM service_request_history 
              WHERE client_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'por_tipo', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT cargo_type as name, COUNT(*) as value
            FROM freight_history
            WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            GROUP BY cargo_type ORDER BY value DESC LIMIT 10
          ) t
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM freight_history
            WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            GROUP BY status_final
          ) s
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT freight_id, origin_city, destination_city, price_total as receita, status_final, completed_at as data, cargo_type
            FROM freight_history
            WHERE producer_id = p_profile_id AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
            ORDER BY data DESC LIMIT 20
          ) op
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL MOTORISTA
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
          'distancia_total_km', COALESCE((
            SELECT SUM(fh.distance_km)
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0),
          'avaliacao_media', COALESCE((
            SELECT AVG(r.rating) FROM driver_ratings r 
            WHERE r.driver_id = p_profile_id AND r.created_at >= p_date_from AND r.created_at <= p_date_to
          ), 0),
          'total_avaliacoes', (
            SELECT COUNT(*) FROM driver_ratings r 
            WHERE r.driver_id = p_profile_id AND r.created_at >= p_date_from AND r.created_at <= p_date_to
          ),
          'despesas_total', COALESCE((
            SELECT SUM(de.amount) FROM driver_expenses de
            WHERE de.driver_id = p_profile_id AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
          ), 0),
          'servicos_total', (
            SELECT COUNT(*) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
          ),
          'servicos_receita', COALESCE((
            SELECT SUM(srh.final_price) FROM service_request_history srh
            WHERE srh.provider_id = p_profile_id AND srh.status_final = 'COMPLETED' AND srh.completed_at >= p_date_from AND srh.completed_at <= p_date_to
          ), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(fah.completed_at, 'YYYY-MM') as mes, 
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT fh.cargo_type as name, COUNT(*) as value
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
            GROUP BY fh.cargo_type ORDER BY value DESC LIMIT 10
          ) t
        ),
        'despesas_por_tipo', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT de.expense_type as name, SUM(de.amount) as value
            FROM driver_expenses de
            WHERE de.driver_id = p_profile_id AND de.expense_date >= p_date_from::date AND de.expense_date <= p_date_to::date
            GROUP BY de.expense_type ORDER BY value DESC
          ) d
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
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT fh.freight_id, fh.origin_city, fh.destination_city, 
                   COALESCE(fah.agreed_price, fh.price_total) as receita,
                   fah.status_final, fah.completed_at as data, fh.cargo_type
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.driver_id = p_profile_id 
              AND COALESCE(fah.completed_at, fah.created_at) >= p_date_from 
              AND COALESCE(fah.completed_at, fah.created_at) <= p_date_to
            ORDER BY data DESC LIMIT 20
          ) op
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL TRANSPORTADORA
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
          'total_motoristas', (
            SELECT COUNT(DISTINCT cd.driver_profile_id) FROM company_drivers cd
            WHERE cd.company_id = v_company_id AND cd.status = 'ACTIVE'
          ),
          'ticket_medio', COALESCE((
            SELECT AVG(COALESCE(fah.agreed_price, fh.price_total))
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
          ), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(fah.completed_at, 'YYYY-MM') as mes, 
                   SUM(COALESCE(fah.agreed_price, fh.price_total)) as receita
            FROM freight_assignment_history fah
            JOIN freight_history fh ON fh.freight_id = fah.freight_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY 1
          ) d
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
  -- PAINEL PRESTADOR
  -- =====================================================
  WHEN 'PRESTADOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'receita_total', COALESCE((
            SELECT SUM(final_price) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0),
          'servicos_concluidos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ),
          'total_servicos', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
          ),
          'avaliacao_media', COALESCE((
            SELECT AVG(pr.rating) FROM provider_ratings pr 
            WHERE pr.provider_id = p_profile_id AND pr.created_at >= p_date_from AND pr.created_at <= p_date_to
          ), 0),
          'total_avaliacoes', (
            SELECT COUNT(*) FROM provider_ratings pr 
            WHERE pr.provider_id = p_profile_id AND pr.created_at >= p_date_from AND pr.created_at <= p_date_to
          ),
          'ticket_medio', COALESCE((
            SELECT AVG(final_price) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0),
          'servicos_cancelados', (
            SELECT COUNT(*) FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'CANCELLED' AND completed_at >= p_date_from AND completed_at <= p_date_to
          )
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(completed_at, 'YYYY-MM') as mes, SUM(final_price) as receita
            FROM service_request_history
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        'por_tipo_servico', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT service_type as name, COUNT(*) as value
            FROM service_request_history
            WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY service_type ORDER BY value DESC LIMIT 10
          ) t
        ),
        'por_cidade', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT city as name, COUNT(*) as value
            FROM service_request_history
            WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to AND city IS NOT NULL
            GROUP BY city ORDER BY value DESC LIMIT 5
          ) c
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM service_request_history
            WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY status_final
          ) s
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(op ORDER BY op.data DESC), '[]'::json) FROM (
            SELECT id, service_type, city, final_price, status_final, completed_at as data
            FROM service_request_history
            WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            ORDER BY data DESC LIMIT 20
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