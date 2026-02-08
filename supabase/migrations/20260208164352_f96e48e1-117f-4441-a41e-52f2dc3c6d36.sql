-- =====================================================
-- FIX: get_reports_dashboard - Count completed freights from assignment history
-- Problem: When a multi-truck freight is cancelled AFTER some drivers delivered,
-- freight_history shows CANCELLED but freight_assignment_history shows DELIVERED.
-- The RPC must consider both sources for accurate reporting.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_reports_dashboard(
  p_panel TEXT,
  p_profile_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT now() - interval '30 days',
  p_date_to TIMESTAMPTZ DEFAULT now(),
  p_filters JSON DEFAULT '{}'::json
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
          'freights_total', (
            SELECT COUNT(*) FROM freight_history 
            WHERE producer_id = p_profile_id 
            AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
            AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
          ),
          -- Count completed freights from BOTH freight_history AND assignment_history
          'freights_completed', (
            SELECT COUNT(DISTINCT freight_id) FROM (
              -- Freight-level completion
              SELECT freight_id FROM freight_history 
              WHERE producer_id = p_profile_id 
              AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION
              -- Assignment-level completion (covers cancelled parent freights with delivered assignments)
              SELECT fah.freight_id FROM freight_assignment_history fah
              JOIN freights f ON f.id = fah.freight_id
              WHERE f.producer_id = p_profile_id 
              AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            ) completed_freights
          ),
          'freights_cancelled', (
            SELECT COUNT(*) FROM freight_history 
            WHERE producer_id = p_profile_id 
            AND status_final = 'CANCELLED' 
            AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
            -- Exclude freights that have delivered assignments (partially completed)
            AND freight_id NOT IN (
              SELECT DISTINCT freight_id FROM freight_assignment_history 
              WHERE status_final IN ('COMPLETED','DELIVERED')
            )
          ),
          -- Total value: from completed freight_history + completed assignments from cancelled freights
          'freights_total_value', COALESCE((
            SELECT SUM(val) FROM (
              -- Completed freights (freight-level)
              SELECT price_total as val FROM freight_history 
              WHERE producer_id = p_profile_id 
              AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              -- Completed assignments from cancelled freights (sum of agreed_price per freight)
              SELECT sub.total_val as val FROM (
                SELECT fah.freight_id, SUM(fah.agreed_price) as total_val
                FROM freight_assignment_history fah
                JOIN freights f ON f.id = fah.freight_id
                WHERE f.producer_id = p_profile_id 
                AND fah.status_final IN ('COMPLETED','DELIVERED')
                AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
                AND NOT EXISTS (
                  SELECT 1 FROM freight_history fh 
                  WHERE fh.freight_id = fah.freight_id 
                  AND fh.status_final IN ('COMPLETED','DELIVERED')
                )
                GROUP BY fah.freight_id
              ) sub
            ) totals
          ), 0),
          'services_total', (
            SELECT COUNT(*) FROM service_request_history 
            WHERE client_id = p_profile_id 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
          ),
          'services_completed', (
            SELECT COUNT(*) FROM service_request_history 
            WHERE client_id = p_profile_id 
            AND status_final = 'COMPLETED' 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
          ),
          'services_total_value', COALESCE((
            SELECT SUM(final_price) FROM service_request_history 
            WHERE client_id = p_profile_id 
            AND status_final = 'COMPLETED' 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0),
          'ticket_medio_frete', COALESCE((
            SELECT AVG(val) FROM (
              SELECT price_total as val FROM freight_history 
              WHERE producer_id = p_profile_id 
              AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              SELECT SUM(fah.agreed_price) as val
              FROM freight_assignment_history fah
              JOIN freights f ON f.id = fah.freight_id
              WHERE f.producer_id = p_profile_id 
              AND fah.status_final IN ('COMPLETED','DELIVERED')
              AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
              AND NOT EXISTS (
                SELECT 1 FROM freight_history fh 
                WHERE fh.freight_id = fah.freight_id 
                AND fh.status_final IN ('COMPLETED','DELIVERED')
              )
              GROUP BY fah.freight_id
            ) avg_vals
          ), 0),
          'ticket_medio_servico', COALESCE((
            SELECT AVG(final_price) FROM service_request_history 
            WHERE client_id = p_profile_id 
            AND status_final = 'COMPLETED' 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
          ), 0)
        )
      ),
      'charts', json_build_object(
        'volume_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(fretes) as fretes, SUM(servicos) as servicos, SUM(fretes + servicos) as total FROM (
              -- Fretes concluídos/entregues (from freight_history)
              SELECT date_trunc('day', completed_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
              UNION ALL
              -- Fretes concluídos via assignment_history (cancelled parent but delivered assignments)
              SELECT date_trunc('day', fah.completed_at)::date as dia, 1 as fretes, 0 as servicos
              FROM (
                SELECT DISTINCT ON (fah2.freight_id) fah2.freight_id, fah2.completed_at
                FROM freight_assignment_history fah2
                JOIN freights f ON f.id = fah2.freight_id
                WHERE f.producer_id = p_profile_id 
                AND fah2.status_final IN ('COMPLETED','DELIVERED')
                AND fah2.completed_at >= p_date_from AND fah2.completed_at <= p_date_to
                AND NOT EXISTS (
                  SELECT 1 FROM freight_history fh 
                  WHERE fh.freight_id = fah2.freight_id 
                  AND fh.status_final IN ('COMPLETED','DELIVERED')
                )
                ORDER BY fah2.freight_id, fah2.completed_at DESC
              ) fah
              UNION ALL
              -- Fretes cancelados (excluding those with delivered assignments)
              SELECT date_trunc('day', cancelled_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final = 'CANCELLED' 
              AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to
              AND freight_id NOT IN (
                SELECT DISTINCT freight_id FROM freight_assignment_history 
                WHERE status_final IN ('COMPLETED','DELIVERED')
              )
              GROUP BY 1
              UNION ALL
              -- Serviços concluídos
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
              -- Valor de fretes concluídos (freight-level)
              SELECT date_trunc('day', completed_at)::date as dia, price_total as valor
              FROM freight_history 
              WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              -- Valor de fretes concluídos via assignments (cancelled parent)
              SELECT date_trunc('day', fah.completed_at)::date as dia, fah.total_val as valor
              FROM (
                SELECT freight_id, MAX(completed_at) as completed_at, SUM(agreed_price) as total_val
                FROM freight_assignment_history fah2
                JOIN freights f ON f.id = fah2.freight_id
                WHERE f.producer_id = p_profile_id 
                AND fah2.status_final IN ('COMPLETED','DELIVERED')
                AND fah2.completed_at >= p_date_from AND fah2.completed_at <= p_date_to
                AND NOT EXISTS (
                  SELECT 1 FROM freight_history fh 
                  WHERE fh.freight_id = fah2.freight_id 
                  AND fh.status_final IN ('COMPLETED','DELIVERED')
                )
                GROUP BY freight_id
              ) fah
              UNION ALL
              -- Valor de serviços concluídos
              SELECT date_trunc('day', completed_at)::date as dia, final_price as valor
              FROM service_request_history 
              WHERE client_id = p_profile_id AND status_final = 'COMPLETED' 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
            ) combined
            GROUP BY dia
          ) d
        ),
        'por_status', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM (
              -- Fretes from history
              SELECT 
                CASE 
                  WHEN fh.status_final = 'CANCELLED' AND EXISTS (
                    SELECT 1 FROM freight_assignment_history fah 
                    WHERE fah.freight_id = fh.freight_id 
                    AND fah.status_final IN ('COMPLETED','DELIVERED')
                  ) THEN 'Concluído'
                  WHEN fh.status_final IN ('COMPLETED','DELIVERED') THEN 'Concluído'
                  WHEN fh.status_final = 'CANCELLED' THEN 'Cancelado'
                  ELSE fh.status_final
                END as status_final
              FROM freight_history fh
              WHERE fh.producer_id = p_profile_id 
              AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from 
              AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to
              UNION ALL
              -- Serviços
              SELECT 
                CASE 
                  WHEN status_final = 'COMPLETED' THEN 'Concluído'
                  WHEN status_final = 'CANCELLED' THEN 'Cancelado'
                  ELSE status_final
                END as status_final
              FROM service_request_history 
              WHERE client_id = p_profile_id 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
            ) all_ops
            GROUP BY status_final
          ) d
        ),
        'tipos_carga', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT name, SUM(value) as value FROM (
              SELECT COALESCE(cargo_type, 'OUTRO') as name, COUNT(*) as value
              FROM freight_history 
              WHERE producer_id = p_profile_id 
              AND COALESCE(completed_at, cancelled_at, created_at) >= p_date_from 
              AND COALESCE(completed_at, cancelled_at, created_at) <= p_date_to
              GROUP BY cargo_type
              UNION ALL
              SELECT 'SERVICO' as name, COUNT(*) as value
              FROM service_request_history 
              WHERE client_id = p_profile_id 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
            ) combined
            GROUP BY name
          ) d
        )
      ),
      'tables', json_build_object(
        'ultimos_fretes', (
          SELECT COALESCE(json_agg(d ORDER BY d.data DESC), '[]'::json) FROM (
            SELECT 
              fh.freight_id as id,
              fh.cargo_type,
              fh.origin_city || '/' || fh.origin_state as origem,
              fh.destination_city || '/' || fh.destination_state as destino,
              CASE 
                WHEN fh.status_final = 'CANCELLED' AND EXISTS (
                  SELECT 1 FROM freight_assignment_history fah 
                  WHERE fah.freight_id = fh.freight_id 
                  AND fah.status_final IN ('COMPLETED','DELIVERED')
                ) THEN 'DELIVERED'
                ELSE fh.status_final
              END as status,
              fh.price_total as valor,
              COALESCE(fh.completed_at, fh.cancelled_at)::date as data
            FROM freight_history fh
            WHERE fh.producer_id = p_profile_id 
            AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) >= p_date_from 
            AND COALESCE(fh.completed_at, fh.cancelled_at, fh.created_at) <= p_date_to
            LIMIT 20
          ) d
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
          'assignments_total', (SELECT COUNT(*) FROM freight_assignment_history WHERE driver_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'assignments_completed', (SELECT COUNT(*) FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'total_earned', COALESCE((SELECT SUM(agreed_price) FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'total_distance', COALESCE((SELECT SUM(distance_km) FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'ticket_medio', COALESCE((SELECT AVG(agreed_price) FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_completed', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_total_value', COALESCE((SELECT SUM(final_price) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0)
        )
      ),
      'charts', json_build_object(
        'ganhos_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(valor) as valor FROM (
              SELECT date_trunc('day', completed_at)::date as dia, agreed_price as valor
              FROM freight_assignment_history 
              WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              SELECT date_trunc('day', completed_at)::date as dia, final_price as valor
              FROM service_request_history 
              WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
            ) combined
            GROUP BY dia
          ) d
        ),
        'viagens_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(fretes) as fretes, SUM(servicos) as servicos FROM (
              SELECT date_trunc('day', completed_at)::date as dia, COUNT(*) as fretes, 0 as servicos
              FROM freight_assignment_history 
              WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
              UNION ALL
              SELECT date_trunc('day', completed_at)::date as dia, 0 as fretes, COUNT(*) as servicos
              FROM service_request_history 
              WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              GROUP BY 1
            ) combined
            GROUP BY dia
          ) d
        ),
        'rotas_frequentes', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT origin_city || '/' || origin_state as origem, 
                   destination_city || '/' || destination_state as destino, 
                   COUNT(*) as viagens
            FROM freight_assignment_history 
            WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1, 2
            ORDER BY viagens DESC
            LIMIT 5
          ) d
        ),
        'tipos_carga', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT COALESCE(cargo_type, 'OUTRO') as name, COUNT(*) as value
            FROM freight_assignment_history 
            WHERE driver_id = p_profile_id 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY cargo_type
          ) d
        )
      ),
      'tables', json_build_object(
        'ultimas_viagens', (
          SELECT COALESCE(json_agg(d ORDER BY d.data DESC), '[]'::json) FROM (
            SELECT 
              freight_id as id,
              cargo_type,
              origin_city || '/' || origin_state as origem,
              destination_city || '/' || destination_state as destino,
              status_final as status,
              agreed_price as valor,
              completed_at::date as data,
              distance_km
            FROM freight_assignment_history 
            WHERE driver_id = p_profile_id 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            LIMIT 20
          ) d
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
          'assignments_total', (SELECT COUNT(*) FROM freight_assignment_history WHERE company_id = v_company_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'assignments_completed', (SELECT COUNT(*) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'total_revenue', COALESCE((SELECT SUM(agreed_price) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'total_distance', COALESCE((SELECT SUM(distance_km) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'active_drivers', (SELECT COUNT(DISTINCT driver_id) FROM freight_assignment_history WHERE company_id = v_company_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'ticket_medio', COALESCE((SELECT AVG(agreed_price) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'services_total', (SELECT COUNT(*) FROM service_request_history WHERE company_id = v_company_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_completed', (SELECT COUNT(*) FROM service_request_history WHERE company_id = v_company_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_total_value', COALESCE((SELECT SUM(final_price) FROM service_request_history WHERE company_id = v_company_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT dia, SUM(valor) as receita FROM (
              SELECT date_trunc('day', completed_at)::date as dia, agreed_price as valor
              FROM freight_assignment_history 
              WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              SELECT date_trunc('day', completed_at)::date as dia, final_price as valor
              FROM service_request_history 
              WHERE company_id = v_company_id AND status_final = 'COMPLETED' 
              AND completed_at >= p_date_from AND completed_at <= p_date_to
            ) combined
            GROUP BY dia
          ) d
        ),
        'motoristas_performance', (
          SELECT COALESCE(json_agg(d ORDER BY d.viagens DESC), '[]'::json) FROM (
            SELECT 
              fah.driver_id,
              COALESCE(p.full_name, 'Motorista') as motorista, 
              COUNT(*) as viagens,
              SUM(fah.agreed_price) as receita,
              SUM(fah.distance_km) as distancia
            FROM freight_assignment_history fah
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id AND fah.status_final IN ('COMPLETED','DELIVERED') 
            AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY fah.driver_id, p.full_name
            ORDER BY viagens DESC
            LIMIT 10
          ) d
        ),
        'receita_por_mes', (
          SELECT COALESCE(json_agg(d ORDER BY d.mes), '[]'::json) FROM (
            SELECT to_char(completed_at, 'YYYY-MM') as mes, SUM(agreed_price) as receita
            FROM freight_assignment_history 
            WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        )
      ),
      'tables', json_build_object(
        'ultimas_viagens', (
          SELECT COALESCE(json_agg(d ORDER BY d.data DESC), '[]'::json) FROM (
            SELECT 
              fah.freight_id as id,
              fah.cargo_type,
              fah.origin_city || '/' || fah.origin_state as origem,
              fah.destination_city || '/' || fah.destination_state as destino,
              fah.status_final as status,
              fah.agreed_price as valor,
              fah.completed_at::date as data,
              COALESCE(p.full_name, 'Motorista') as motorista
            FROM freight_assignment_history fah
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id 
            AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            LIMIT 20
          ) d
        )
      )
    ) INTO v_result;

  -- =====================================================
  -- PAINEL PRESTADOR DE SERVIÇOS
  -- =====================================================
  WHEN 'PRESTADOR' THEN
    SELECT json_build_object(
      'kpis', (
        SELECT json_build_object(
          'services_total', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'services_completed', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'total_revenue', COALESCE((SELECT SUM(final_price) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'ticket_medio', COALESCE((SELECT AVG(final_price) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'unique_clients', (SELECT COUNT(DISTINCT client_id) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to)
        )
      ),
      'charts', json_build_object(
        'receita_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', completed_at)::date as dia, SUM(final_price) as receita
            FROM service_request_history 
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        'servicos_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', completed_at)::date as dia, COUNT(*) as total
            FROM service_request_history 
            WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        'tipos_servico', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT COALESCE(service_type, 'OUTRO') as name, COUNT(*) as value
            FROM service_request_history 
            WHERE provider_id = p_profile_id 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY service_type
          ) d
        )
      ),
      'tables', json_build_object(
        'ultimos_servicos', (
          SELECT COALESCE(json_agg(d ORDER BY d.data DESC), '[]'::json) FROM (
            SELECT 
              id,
              service_type,
              status_final as status,
              final_price as valor,
              completed_at::date as data
            FROM service_request_history 
            WHERE provider_id = p_profile_id 
            AND completed_at >= p_date_from AND completed_at <= p_date_to
            LIMIT 20
          ) d
        )
      )
    ) INTO v_result;

  ELSE
    RAISE EXCEPTION 'Painel inválido: %', p_panel;
  END CASE;

  RETURN v_result;
END;
$$;