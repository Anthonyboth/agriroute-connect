
-- Update get_reports_dashboard: Include urban freights (PET, Pacotes, Guincho) in MOTORISTA KPIs
-- Urban freights from service_request_history where provider_id = driver should count as trips

DROP FUNCTION IF EXISTS public.get_reports_dashboard(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB);

CREATE FUNCTION public.get_reports_dashboard(
  p_panel TEXT,
  p_profile_id UUID,
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_receita_total NUMERIC := 0;
  v_servicos_receita NUMERIC := 0;
  v_urban_freights_receita NUMERIC := 0;
  v_urban_freights_count BIGINT := 0;
  v_urban_cancelamentos BIGINT := 0;
  v_urban_total BIGINT := 0;
  v_viagens_concluidas BIGINT := 0;
  v_km_total NUMERIC := 0;
  v_peso_total NUMERIC := 0;
  v_avg_rating NUMERIC := 0;
  v_count_rating BIGINT := 0;
  v_despesas_total NUMERIC := 0;
  v_cancelamentos BIGINT := 0;
  v_total_assignments BIGINT := 0;
  v_avg_cycle_hours NUMERIC := 0;
  v_receita_por_mes JSONB := '[]'::JSONB;
  v_viagens_por_mes JSONB := '[]'::JSONB;
  v_top_rotas JSONB := '[]'::JSONB;
  v_dispersao_receita_km JSONB := '[]'::JSONB;
BEGIN
  IF p_panel = 'MOTORISTA' THEN

    -- KPIs principais de frete rural (freight_assignment_history)
    SELECT
      COALESCE(SUM(fah.agreed_price), 0),
      COUNT(*),
      COALESCE(SUM(fah.distance_km), 0),
      COALESCE(SUM(fah.weight_per_truck), 0),
      COALESCE(AVG(
        EXTRACT(EPOCH FROM (fah.delivery_confirmed_at - fah.created_at)) / 3600.0
      ) FILTER (WHERE fah.delivery_confirmed_at IS NOT NULL), 0)
    INTO v_receita_total, v_viagens_concluidas, v_km_total, v_peso_total, v_avg_cycle_hours
    FROM freight_assignment_history fah
    WHERE fah.driver_id = p_profile_id
      AND fah.status_final IN ('DELIVERED', 'COMPLETED', 'PAYMENT_CONFIRMED')
      AND fah.created_at BETWEEN p_date_from AND p_date_to;

    -- Fretes urbanos executados pelo motorista (PET, Pacotes, Guincho)
    SELECT
      COALESCE(SUM(COALESCE(srh.final_price, srh.estimated_price, 0)), 0),
      COUNT(*)
    INTO v_urban_freights_receita, v_urban_freights_count
    FROM service_request_history srh
    WHERE srh.provider_id = p_profile_id
      AND srh.status_final = 'COMPLETED'
      AND srh.service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')
      AND srh.created_at BETWEEN p_date_from AND p_date_to;

    -- Cancelamentos e total de fretes urbanos
    SELECT
      COUNT(*) FILTER (WHERE srh.status_final IN ('CANCELLED', 'CANCELED')),
      COUNT(*)
    INTO v_urban_cancelamentos, v_urban_total
    FROM service_request_history srh
    WHERE srh.provider_id = p_profile_id
      AND srh.service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')
      AND srh.created_at BETWEEN p_date_from AND p_date_to;

    -- Receita de serviços técnicos (excluindo fretes urbanos)
    SELECT COALESCE(SUM(COALESCE(srh.final_price, srh.estimated_price, 0)), 0)
    INTO v_servicos_receita
    FROM service_request_history srh
    WHERE srh.provider_id = p_profile_id
      AND srh.status_final = 'COMPLETED'
      AND srh.service_type NOT IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')
      AND srh.created_at BETWEEN p_date_from AND p_date_to;

    -- Somar fretes urbanos aos KPIs
    v_viagens_concluidas := v_viagens_concluidas + v_urban_freights_count;
    v_receita_total := v_receita_total + v_urban_freights_receita;

    -- Avaliações recebidas
    SELECT
      COALESCE(AVG(r.rating::NUMERIC), 0),
      COUNT(*)
    INTO v_avg_rating, v_count_rating
    FROM ratings r
    WHERE r.rated_user_id = p_profile_id
      AND r.created_at BETWEEN p_date_from AND p_date_to;

    -- Despesas do motorista
    SELECT COALESCE(SUM(de.amount), 0)
    INTO v_despesas_total
    FROM driver_expenses de
    WHERE de.driver_id = p_profile_id
      AND de.expense_date::TIMESTAMPTZ BETWEEN p_date_from AND p_date_to;

    -- Total e cancelamentos (rural + urbano)
    SELECT
      COUNT(*) FILTER (WHERE fah.status_final IN ('CANCELLED', 'CANCELED')),
      COUNT(*)
    INTO v_cancelamentos, v_total_assignments
    FROM freight_assignment_history fah
    WHERE fah.driver_id = p_profile_id
      AND fah.created_at BETWEEN p_date_from AND p_date_to;

    v_cancelamentos := v_cancelamentos + v_urban_cancelamentos;
    v_total_assignments := v_total_assignments + v_urban_total;

    -- Receita por mês (rural + urbano consolidado)
    SELECT COALESCE(jsonb_agg(row_data ORDER BY mes_dt), '[]'::jsonb)
    INTO v_receita_por_mes
    FROM (
      SELECT
        mes_dt,
        jsonb_build_object(
          'mes', TO_CHAR(mes_dt, 'Mon/YY'),
          'receita', SUM(receita),
          'viagens', SUM(viagens)
        ) as row_data
      FROM (
        -- Rural
        SELECT
          DATE_TRUNC('month', fah.created_at) as mes_dt,
          COALESCE(SUM(fah.agreed_price), 0) as receita,
          COUNT(*) as viagens
        FROM freight_assignment_history fah
        WHERE fah.driver_id = p_profile_id
          AND fah.status_final IN ('DELIVERED', 'COMPLETED', 'PAYMENT_CONFIRMED')
          AND fah.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY DATE_TRUNC('month', fah.created_at)
        UNION ALL
        -- Urban
        SELECT
          DATE_TRUNC('month', srh.created_at) as mes_dt,
          COALESCE(SUM(COALESCE(srh.final_price, srh.estimated_price, 0)), 0) as receita,
          COUNT(*) as viagens
        FROM service_request_history srh
        WHERE srh.provider_id = p_profile_id
          AND srh.status_final = 'COMPLETED'
          AND srh.service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')
          AND srh.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY DATE_TRUNC('month', srh.created_at)
      ) combined
      GROUP BY mes_dt
    ) sub;

    -- Viagens por mês (rural + urbano)
    SELECT COALESCE(jsonb_agg(row_data ORDER BY mes_dt), '[]'::jsonb)
    INTO v_viagens_por_mes
    FROM (
      SELECT
        mes_dt,
        jsonb_build_object(
          'mes', TO_CHAR(mes_dt, 'Mon/YY'),
          'viagens', SUM(viagens),
          'km', SUM(km)
        ) as row_data
      FROM (
        SELECT
          DATE_TRUNC('month', fah.created_at) as mes_dt,
          COUNT(*) as viagens,
          COALESCE(SUM(fah.distance_km), 0) as km
        FROM freight_assignment_history fah
        WHERE fah.driver_id = p_profile_id
          AND fah.status_final IN ('DELIVERED', 'COMPLETED', 'PAYMENT_CONFIRMED')
          AND fah.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY DATE_TRUNC('month', fah.created_at)
        UNION ALL
        SELECT
          DATE_TRUNC('month', srh.created_at) as mes_dt,
          COUNT(*) as viagens,
          0 as km
        FROM service_request_history srh
        WHERE srh.provider_id = p_profile_id
          AND srh.status_final = 'COMPLETED'
          AND srh.service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')
          AND srh.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY DATE_TRUNC('month', srh.created_at)
      ) combined
      GROUP BY mes_dt
    ) sub;

    -- Top 5 rotas (rural + urbano)
    SELECT COALESCE(jsonb_agg(row_data ORDER BY receita_total DESC), '[]'::jsonb)
    INTO v_top_rotas
    FROM (
      SELECT
        jsonb_build_object(
          'rota', rota,
          'receita', receita_total,
          'viagens', viagens_total,
          'km_medio', km_medio
        ) as row_data,
        receita_total
      FROM (
        SELECT
          fah.origin_city || '/' || fah.origin_state || ' → ' || fah.destination_city || '/' || fah.destination_state as rota,
          COALESCE(SUM(fah.agreed_price), 0) as receita_total,
          COUNT(*) as viagens_total,
          COALESCE(AVG(fah.distance_km), 0) as km_medio
        FROM freight_assignment_history fah
        WHERE fah.driver_id = p_profile_id
          AND fah.status_final IN ('DELIVERED', 'COMPLETED', 'PAYMENT_CONFIRMED')
          AND fah.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY rota
        UNION ALL
        SELECT
          COALESCE(srh.city, 'Local') || '/' || COALESCE(srh.state, '') || ' → Urbano' as rota,
          COALESCE(SUM(COALESCE(srh.final_price, srh.estimated_price, 0)), 0) as receita_total,
          COUNT(*) as viagens_total,
          0 as km_medio
        FROM service_request_history srh
        WHERE srh.provider_id = p_profile_id
          AND srh.status_final = 'COMPLETED'
          AND srh.service_type IN ('TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO')
          AND srh.created_at BETWEEN p_date_from AND p_date_to
        GROUP BY srh.city, srh.state
      ) all_routes
      ORDER BY receita_total DESC
      LIMIT 5
    ) sub;

    -- Dispersão Receita vs Distância (rural only, urban has no distance)
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'km', fah.distance_km,
        'receita', fah.agreed_price,
        'cargo', fah.cargo_type,
        'rota', fah.origin_city || ' → ' || fah.destination_city
      )
    ), '[]'::jsonb)
    INTO v_dispersao_receita_km
    FROM freight_assignment_history fah
    WHERE fah.driver_id = p_profile_id
      AND fah.status_final IN ('DELIVERED', 'COMPLETED', 'PAYMENT_CONFIRMED')
      AND fah.created_at BETWEEN p_date_from AND p_date_to
      AND fah.distance_km IS NOT NULL
      AND fah.agreed_price IS NOT NULL;

    v_result := jsonb_build_object(
      'panel', 'MOTORISTA',
      'kpis', jsonb_build_object(
        'receita_total', v_receita_total + v_servicos_receita,
        'receita_fretes', v_receita_total,
        'receita_servicos', v_servicos_receita,
        'lucro_liquido', (v_receita_total + v_servicos_receita) - v_despesas_total,
        'viagens_concluidas', v_viagens_concluidas,
        'km_total', v_km_total,
        'peso_total', v_peso_total,
        'rpm_medio', CASE WHEN v_km_total > 0 THEN ROUND((v_receita_total / v_km_total)::NUMERIC, 2) ELSE 0 END,
        'rton_medio', CASE WHEN v_peso_total > 0 THEN ROUND((v_receita_total / v_peso_total)::NUMERIC, 2) ELSE NULL END,
        'ticket_medio', CASE WHEN v_viagens_concluidas > 0 THEN ROUND((v_receita_total / v_viagens_concluidas)::NUMERIC, 2) ELSE 0 END,
        'avg_cycle_hours', ROUND(v_avg_cycle_hours::NUMERIC, 1),
        'avaliacao_media', ROUND(v_avg_rating::NUMERIC, 1),
        'total_avaliacoes', v_count_rating,
        'despesas_total', v_despesas_total,
        'taxa_conclusao', CASE WHEN v_total_assignments > 0 THEN ROUND((v_viagens_concluidas::NUMERIC / v_total_assignments * 100), 1) ELSE 0 END,
        'taxa_cancelamento', CASE WHEN v_total_assignments > 0 THEN ROUND((v_cancelamentos::NUMERIC / v_total_assignments * 100), 1) ELSE 0 END
      ),
      'charts', jsonb_build_object(
        'receita_por_mes', v_receita_por_mes,
        'viagens_por_mes', v_viagens_por_mes,
        'top_rotas', v_top_rotas,
        'dispersao_receita_km', v_dispersao_receita_km
      )
    );

  ELSE
    v_result := jsonb_build_object(
      'panel', p_panel,
      'kpis', '{}'::jsonb,
      'charts', '{}'::jsonb
    );
  END IF;

  RETURN v_result;
END;
$$;
