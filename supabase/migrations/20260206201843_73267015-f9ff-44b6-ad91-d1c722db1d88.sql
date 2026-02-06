
-- =====================================================
-- PARTE A: TABELAS DE HISTÓRICO
-- =====================================================

-- 1. freight_history
CREATE TABLE IF NOT EXISTS public.freight_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL,
  producer_id UUID,
  is_guest_freight BOOLEAN NOT NULL DEFAULT false,
  company_id UUID,
  driver_id UUID,
  required_trucks INTEGER NOT NULL DEFAULT 1,
  accepted_trucks INTEGER NOT NULL DEFAULT 0,
  status_final TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  origin_city TEXT,
  origin_state TEXT,
  destination_city TEXT,
  destination_state TEXT,
  distance_km NUMERIC DEFAULT 0,
  weight NUMERIC DEFAULT 0,
  price_total NUMERIC NOT NULL DEFAULT 0,
  price_per_truck NUMERIC NOT NULL DEFAULT 0,
  cargo_type TEXT,
  source TEXT NOT NULL DEFAULT 'TRIGGER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(freight_id)
);

CREATE INDEX idx_freight_history_producer ON public.freight_history(producer_id) WHERE producer_id IS NOT NULL;
CREATE INDEX idx_freight_history_driver ON public.freight_history(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX idx_freight_history_company ON public.freight_history(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_freight_history_completed ON public.freight_history(completed_at DESC);
CREATE INDEX idx_freight_history_status ON public.freight_history(status_final);

ALTER TABLE public.freight_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own freight history" ON public.freight_history
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
      driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
      company_id IN (SELECT tc.id FROM transport_companies tc JOIN profiles p ON p.id = tc.profile_id WHERE p.user_id = auth.uid())
    )
  );

-- INSERT somente via trigger (SECURITY DEFINER)
CREATE POLICY "System inserts freight history" ON public.freight_history
  FOR INSERT WITH CHECK (true);

-- 2. freight_assignment_history
CREATE TABLE IF NOT EXISTS public.freight_assignment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL,
  assignment_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  company_id UUID,
  status_final TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  agreed_price NUMERIC NOT NULL DEFAULT 0,
  distance_km NUMERIC DEFAULT 0,
  weight_per_truck NUMERIC DEFAULT 0,
  origin_city TEXT,
  origin_state TEXT,
  destination_city TEXT,
  destination_state TEXT,
  cargo_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id)
);

CREATE INDEX idx_fah_driver ON public.freight_assignment_history(driver_id);
CREATE INDEX idx_fah_company ON public.freight_assignment_history(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_fah_freight ON public.freight_assignment_history(freight_id);
CREATE INDEX idx_fah_completed ON public.freight_assignment_history(completed_at DESC);
CREATE INDEX idx_fah_status ON public.freight_assignment_history(status_final);

ALTER TABLE public.freight_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers read own assignment history" ON public.freight_assignment_history
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
      company_id IN (SELECT tc.id FROM transport_companies tc JOIN profiles p ON p.id = tc.profile_id WHERE p.user_id = auth.uid())
    )
  );

CREATE POLICY "System inserts assignment history" ON public.freight_assignment_history
  FOR INSERT WITH CHECK (true);

-- 3. service_request_history
CREATE TABLE IF NOT EXISTS public.service_request_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id UUID NOT NULL,
  client_id UUID,
  provider_id UUID,
  service_type TEXT,
  status_final TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  city TEXT,
  state TEXT,
  estimated_price NUMERIC DEFAULT 0,
  final_price NUMERIC DEFAULT 0,
  contact_name TEXT,
  contact_phone TEXT,
  source TEXT NOT NULL DEFAULT 'TRIGGER',
  UNIQUE(service_request_id)
);

CREATE INDEX idx_srh_client ON public.service_request_history(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_srh_provider ON public.service_request_history(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX idx_srh_completed ON public.service_request_history(completed_at DESC);
CREATE INDEX idx_srh_status ON public.service_request_history(status_final);

ALTER TABLE public.service_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own service history" ON public.service_request_history
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
      provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "System inserts service history" ON public.service_request_history
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- PARTE B: TRIGGERS
-- =====================================================

-- 1. Trigger para freight_history
CREATE OR REPLACE FUNCTION public.log_freight_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price_per_truck NUMERIC;
BEGIN
  -- Só dispara quando status muda para COMPLETED, DELIVERED ou CANCELLED
  IF NEW.status::text NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED') THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status::text = NEW.status::text THEN
    RETURN NEW;
  END IF;

  -- Calcular price_per_truck com proteção div/0
  v_price_per_truck := CASE
    WHEN COALESCE(NEW.required_trucks, 1) > 0
    THEN COALESCE(NEW.price, 0) / COALESCE(NEW.required_trucks, 1)
    ELSE COALESCE(NEW.price, 0)
  END;

  INSERT INTO public.freight_history (
    freight_id, producer_id, is_guest_freight, company_id, driver_id,
    required_trucks, accepted_trucks, status_final,
    completed_at, cancelled_at,
    origin_city, origin_state, destination_city, destination_state,
    distance_km, weight, price_total, price_per_truck, cargo_type, source
  ) VALUES (
    NEW.id,
    NEW.producer_id,
    COALESCE(NEW.is_guest_freight, false),
    NEW.company_id,
    NEW.driver_id,
    COALESCE(NEW.required_trucks, 1),
    COALESCE(NEW.accepted_trucks, 0),
    NEW.status::text,
    CASE WHEN NEW.status::text IN ('COMPLETED', 'DELIVERED') THEN now() ELSE NULL END,
    CASE WHEN NEW.status::text = 'CANCELLED' THEN COALESCE(NEW.cancelled_at, now()) ELSE NULL END,
    NEW.origin_city,
    NEW.origin_state,
    NEW.destination_city,
    NEW.destination_state,
    COALESCE(NEW.distance_km, 0),
    COALESCE(NEW.weight, 0),
    COALESCE(NEW.price, 0),
    v_price_per_truck,
    COALESCE(NEW.cargo_type, NEW.service_type, 'FRETE'),
    'TRIGGER'
  )
  ON CONFLICT (freight_id) DO UPDATE SET
    status_final = EXCLUDED.status_final,
    completed_at = EXCLUDED.completed_at,
    cancelled_at = EXCLUDED.cancelled_at,
    accepted_trucks = EXCLUDED.accepted_trucks,
    price_total = EXCLUDED.price_total,
    price_per_truck = EXCLUDED.price_per_truck;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_freight_history ON public.freights;
CREATE TRIGGER trg_log_freight_history
  AFTER UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION public.log_freight_to_history();

-- 2. Trigger para freight_assignment_history
CREATE OR REPLACE FUNCTION public.log_assignment_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
BEGIN
  -- Só dispara quando status muda para COMPLETED ou DELIVERED
  IF NEW.status NOT IN ('COMPLETED', 'DELIVERED') THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Buscar dados do frete pai
  SELECT origin_city, origin_state, destination_city, destination_state,
         distance_km, weight, cargo_type, required_trucks
  INTO v_freight
  FROM public.freights
  WHERE id = NEW.freight_id;

  INSERT INTO public.freight_assignment_history (
    freight_id, assignment_id, driver_id, company_id,
    status_final, completed_at, agreed_price,
    distance_km, weight_per_truck,
    origin_city, origin_state, destination_city, destination_state, cargo_type
  ) VALUES (
    NEW.freight_id,
    NEW.id,
    NEW.driver_id,
    NEW.company_id,
    NEW.status,
    COALESCE(NEW.delivered_at, now()),
    COALESCE(NEW.agreed_price, 0),
    COALESCE(v_freight.distance_km, 0),
    CASE
      WHEN COALESCE(v_freight.required_trucks, 1) > 0
      THEN COALESCE(v_freight.weight, 0) / COALESCE(v_freight.required_trucks, 1)
      ELSE COALESCE(v_freight.weight, 0)
    END,
    v_freight.origin_city,
    v_freight.origin_state,
    v_freight.destination_city,
    v_freight.destination_state,
    v_freight.cargo_type
  )
  ON CONFLICT (assignment_id) DO UPDATE SET
    status_final = EXCLUDED.status_final,
    completed_at = EXCLUDED.completed_at,
    agreed_price = EXCLUDED.agreed_price;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_assignment_history ON public.freight_assignments;
CREATE TRIGGER trg_log_assignment_history
  AFTER UPDATE ON public.freight_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_assignment_to_history();

-- 3. Trigger para service_request_history
CREATE OR REPLACE FUNCTION public.log_service_to_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara quando status muda para COMPLETED ou CANCELLED
  IF NEW.status NOT IN ('COMPLETED', 'CANCELLED') THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND COALESCE(OLD.status, '') = NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.service_request_history (
    service_request_id, client_id, provider_id, service_type,
    status_final, accepted_at, completed_at, cancelled_at,
    city, state, estimated_price, final_price,
    contact_name, contact_phone, source
  ) VALUES (
    NEW.id,
    NEW.client_id,
    NEW.provider_id,
    NEW.service_type,
    NEW.status,
    NEW.accepted_at,
    CASE WHEN NEW.status = 'COMPLETED' THEN COALESCE(NEW.completed_at, now()) ELSE NULL END,
    CASE WHEN NEW.status = 'CANCELLED' THEN COALESCE(NEW.cancelled_at, now()) ELSE NULL END,
    COALESCE(NEW.city_name, NEW.location_city),
    COALESCE(NEW.state, NEW.location_state),
    COALESCE(NEW.estimated_price, 0),
    COALESCE(NEW.final_price, NEW.estimated_price, 0),
    NEW.contact_name,
    NEW.contact_phone,
    'TRIGGER'
  )
  ON CONFLICT (service_request_id) DO UPDATE SET
    status_final = EXCLUDED.status_final,
    completed_at = EXCLUDED.completed_at,
    cancelled_at = EXCLUDED.cancelled_at,
    final_price = EXCLUDED.final_price;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_service_history ON public.service_requests;
CREATE TRIGGER trg_log_service_history
  AFTER UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_service_to_history();

-- =====================================================
-- PARTE C: RPC get_reports_dashboard
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_reports_dashboard(
  p_panel TEXT,
  p_profile_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_date_to TIMESTAMPTZ DEFAULT now(),
  p_filters JSONB DEFAULT '{}'::jsonb
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
          'freights_total', (SELECT COUNT(*) FROM freight_history WHERE producer_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
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
            SELECT date_trunc('day', completed_at)::date as dia, COUNT(*) as total
            FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        'valor_por_dia', (
          SELECT COALESCE(json_agg(d ORDER BY d.dia), '[]'::json) FROM (
            SELECT date_trunc('day', completed_at)::date as dia, COALESCE(SUM(price_total), 0) as valor
            FROM freight_history WHERE producer_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) d
        ),
        'por_tipo', (
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT cargo_type as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY cargo_type ORDER BY value DESC LIMIT 10
          ) t
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM freight_history WHERE producer_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY status_final
          ) s
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(o), '[]'::json) FROM (
            SELECT freight_id, origin_city, origin_state, destination_city, destination_state,
                   price_total, status_final, completed_at, cargo_type, required_trucks
            FROM freight_history WHERE producer_id = p_profile_id
            ORDER BY completed_at DESC NULLS LAST LIMIT 50
          ) o
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
          -- Receita do motorista: somar por assignment (agreed_price) + fretes single-truck diretos
          'receita_total', COALESCE((
            SELECT SUM(val) FROM (
              -- Via assignments (multi-carreta)
              SELECT SUM(agreed_price) as val FROM freight_assignment_history
              WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              -- Fretes single-truck diretos (sem assignment)
              SELECT SUM(fh.price_total) as val FROM freight_history fh
              WHERE fh.driver_id = p_profile_id AND fh.status_final IN ('COMPLETED','DELIVERED') AND fh.completed_at >= p_date_from AND fh.completed_at <= p_date_to
              AND fh.required_trucks = 1
              AND NOT EXISTS (SELECT 1 FROM freight_assignment_history fah WHERE fah.freight_id = fh.freight_id AND fah.driver_id = p_profile_id)
            ) sub
          ), 0),
          'total_fretes', (
            SELECT COUNT(DISTINCT freight_id) FROM (
              SELECT freight_id FROM freight_assignment_history WHERE driver_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION
              SELECT freight_id FROM freight_history WHERE driver_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to AND required_trucks = 1
              AND NOT EXISTS (SELECT 1 FROM freight_assignment_history fah2 WHERE fah2.freight_id = freight_history.freight_id AND fah2.driver_id = p_profile_id)
            ) sub
          ),
          'fretes_concluidos', (
            SELECT COUNT(DISTINCT freight_id) FROM (
              SELECT freight_id FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION
              SELECT freight_id FROM freight_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to AND required_trucks = 1
              AND NOT EXISTS (SELECT 1 FROM freight_assignment_history fah3 WHERE fah3.freight_id = freight_history.freight_id AND fah3.driver_id = p_profile_id)
            ) sub
          ),
          'distancia_total_km', COALESCE((
            SELECT SUM(distance_km) FROM (
              SELECT DISTINCT ON (freight_id) distance_km FROM freight_assignment_history
              WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
              UNION ALL
              SELECT distance_km FROM freight_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to AND required_trucks = 1
              AND NOT EXISTS (SELECT 1 FROM freight_assignment_history fah4 WHERE fah4.freight_id = freight_history.freight_id AND fah4.driver_id = p_profile_id)
            ) sub
          ), 0),
          'servicos_total', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'servicos_receita', COALESCE((SELECT SUM(final_price) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'avaliacao_media', COALESCE((SELECT AVG(rating) FROM freight_ratings WHERE rated_user_id = p_profile_id AND created_at >= p_date_from AND created_at <= p_date_to), 0),
          'total_avaliacoes', (SELECT COUNT(*) FROM freight_ratings WHERE rated_user_id = p_profile_id AND created_at >= p_date_from AND created_at <= p_date_to),
          'despesas_total', COALESCE((SELECT SUM(amount) FROM driver_expenses WHERE driver_id = p_profile_id AND expense_date >= p_date_from::date AND expense_date <= p_date_to::date), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(m ORDER BY m.mes), '[]'::json) FROM (
            SELECT TO_CHAR(completed_at, 'YYYY-MM') as mes, COALESCE(SUM(agreed_price), 0) as receita, COUNT(*) as total
            FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) m
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value FROM freight_assignment_history
            WHERE driver_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY status_final
          ) s
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT COALESCE(cargo_type, 'Não especificado') as name, COUNT(*) as value
            FROM freight_assignment_history WHERE driver_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY cargo_type ORDER BY value DESC LIMIT 10
          ) c
        ),
        'despesas_por_tipo', (
          SELECT COALESCE(json_agg(e), '[]'::json) FROM (
            SELECT expense_type as name, COALESCE(SUM(amount), 0) as value
            FROM driver_expenses WHERE driver_id = p_profile_id AND expense_date >= p_date_from::date AND expense_date <= p_date_to::date
            GROUP BY expense_type ORDER BY value DESC
          ) e
        ),
        'top_rotas', (
          SELECT COALESCE(json_agg(r), '[]'::json) FROM (
            SELECT origin_city as origem, destination_city as destino, COUNT(*) as total, COALESCE(SUM(agreed_price), 0) as receita
            FROM freight_assignment_history WHERE driver_id = p_profile_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            AND origin_city IS NOT NULL AND destination_city IS NOT NULL
            GROUP BY origin_city, destination_city ORDER BY total DESC LIMIT 5
          ) r
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(o), '[]'::json) FROM (
            SELECT fah.freight_id, fah.origin_city, fah.origin_state, fah.destination_city, fah.destination_state,
                   fah.agreed_price as valor, fah.status_final, fah.completed_at, fah.cargo_type
            FROM freight_assignment_history fah
            WHERE fah.driver_id = p_profile_id
            ORDER BY fah.completed_at DESC NULLS LAST LIMIT 50
          ) o
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
          'receita_total', COALESCE((SELECT SUM(agreed_price) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'total_fretes', (SELECT COUNT(DISTINCT freight_id) FROM freight_assignment_history WHERE company_id = v_company_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'fretes_concluidos', (SELECT COUNT(DISTINCT freight_id) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'total_motoristas', (SELECT COUNT(DISTINCT driver_id) FROM freight_assignment_history WHERE company_id = v_company_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'ticket_medio', COALESCE((SELECT AVG(agreed_price) FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to), 0)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(m ORDER BY m.mes), '[]'::json) FROM (
            SELECT TO_CHAR(completed_at, 'YYYY-MM') as mes, COALESCE(SUM(agreed_price), 0) as receita, COUNT(*) as total
            FROM freight_assignment_history WHERE company_id = v_company_id AND status_final IN ('COMPLETED','DELIVERED') AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) m
        ),
        'por_motorista', (
          SELECT COALESCE(json_agg(d), '[]'::json) FROM (
            SELECT fah.driver_id, COALESCE(p.full_name, 'Desconhecido') as motorista, COUNT(*) as viagens, COALESCE(SUM(fah.agreed_price), 0) as receita
            FROM freight_assignment_history fah
            LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id AND fah.completed_at >= p_date_from AND fah.completed_at <= p_date_to
            GROUP BY fah.driver_id, p.full_name ORDER BY viagens DESC LIMIT 10
          ) d
        ),
        'por_tipo_carga', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT COALESCE(cargo_type, 'Não especificado') as name, COUNT(*) as value
            FROM freight_assignment_history WHERE company_id = v_company_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY cargo_type ORDER BY value DESC LIMIT 10
          ) c
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(o), '[]'::json) FROM (
            SELECT fah.freight_id, fah.origin_city, fah.destination_city, fah.agreed_price as valor,
                   fah.status_final, fah.completed_at, COALESCE(p.full_name, 'Desconhecido') as motorista
            FROM freight_assignment_history fah LEFT JOIN profiles p ON p.id = fah.driver_id
            WHERE fah.company_id = v_company_id
            ORDER BY fah.completed_at DESC NULLS LAST LIMIT 50
          ) o
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
          'receita_total', COALESCE((SELECT SUM(final_price) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'total_servicos', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'servicos_concluidos', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to),
          'servicos_cancelados', (SELECT COUNT(*) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'CANCELLED' AND cancelled_at >= p_date_from AND cancelled_at <= p_date_to),
          'ticket_medio', COALESCE((SELECT AVG(final_price) FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'avaliacao_media', COALESCE((SELECT AVG(provider_rating) FROM service_requests WHERE provider_id = p_profile_id AND provider_rating IS NOT NULL AND completed_at >= p_date_from AND completed_at <= p_date_to), 0),
          'total_avaliacoes', (SELECT COUNT(*) FROM service_requests WHERE provider_id = p_profile_id AND provider_rating IS NOT NULL AND completed_at >= p_date_from AND completed_at <= p_date_to)
        )
      ),
      'charts', json_build_object(
        'receita_por_mes', (
          SELECT COALESCE(json_agg(m ORDER BY m.mes), '[]'::json) FROM (
            SELECT TO_CHAR(completed_at, 'YYYY-MM') as mes, COALESCE(SUM(final_price), 0) as receita, COUNT(*) as total
            FROM service_request_history WHERE provider_id = p_profile_id AND status_final = 'COMPLETED' AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY 1
          ) m
        ),
        'por_tipo_servico', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT COALESCE(service_type, 'Não especificado') as name, COUNT(*) as value
            FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY service_type ORDER BY value DESC LIMIT 10
          ) s
        ),
        'por_cidade', (
          SELECT COALESCE(json_agg(c), '[]'::json) FROM (
            SELECT COALESCE(city, 'Não especificada') as name, COUNT(*) as value
            FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY city ORDER BY value DESC LIMIT 10
          ) c
        ),
        'por_status', (
          SELECT COALESCE(json_agg(s), '[]'::json) FROM (
            SELECT status_final as name, COUNT(*) as value
            FROM service_request_history WHERE provider_id = p_profile_id AND completed_at >= p_date_from AND completed_at <= p_date_to
            GROUP BY status_final
          ) s
        )
      ),
      'tables', json_build_object(
        'ultimas_operacoes', (
          SELECT COALESCE(json_agg(o), '[]'::json) FROM (
            SELECT service_request_id, service_type, city, state, final_price as valor, status_final, completed_at
            FROM service_request_history WHERE provider_id = p_profile_id
            ORDER BY completed_at DESC NULLS LAST LIMIT 50
          ) o
        )
      )
    ) INTO v_result;

  ELSE
    RAISE EXCEPTION 'Painel inválido: %', p_panel;
  END CASE;

  RETURN v_result;
END;
$$;

-- =====================================================
-- PARTE D: Backfill - popular histórico com dados existentes
-- =====================================================

-- Backfill freight_history a partir de fretes já concluídos/cancelados
INSERT INTO public.freight_history (
  freight_id, producer_id, is_guest_freight, company_id, driver_id,
  required_trucks, accepted_trucks, status_final,
  completed_at, cancelled_at,
  origin_city, origin_state, destination_city, destination_state,
  distance_km, weight, price_total, price_per_truck, cargo_type, source
)
SELECT
  f.id, f.producer_id, COALESCE(f.is_guest_freight, false), f.company_id, f.driver_id,
  COALESCE(f.required_trucks, 1), COALESCE(f.accepted_trucks, 0), f.status::text,
  CASE WHEN f.status::text IN ('COMPLETED', 'DELIVERED') THEN COALESCE(f.delivery_date, f.updated_at) ELSE NULL END,
  CASE WHEN f.status::text = 'CANCELLED' THEN COALESCE(f.cancelled_at, f.updated_at) ELSE NULL END,
  f.origin_city, f.origin_state, f.destination_city, f.destination_state,
  COALESCE(f.distance_km, 0), COALESCE(f.weight, 0), COALESCE(f.price, 0),
  CASE WHEN COALESCE(f.required_trucks, 1) > 0 THEN COALESCE(f.price, 0) / COALESCE(f.required_trucks, 1) ELSE COALESCE(f.price, 0) END,
  COALESCE(f.cargo_type, f.service_type, 'FRETE'), 'BACKFILL'
FROM public.freights f
WHERE f.status::text IN ('COMPLETED', 'DELIVERED', 'CANCELLED')
ON CONFLICT (freight_id) DO NOTHING;

-- Backfill freight_assignment_history
INSERT INTO public.freight_assignment_history (
  freight_id, assignment_id, driver_id, company_id,
  status_final, completed_at, agreed_price,
  distance_km, weight_per_truck,
  origin_city, origin_state, destination_city, destination_state, cargo_type
)
SELECT
  fa.freight_id, fa.id, fa.driver_id, fa.company_id,
  fa.status, COALESCE(fa.delivered_at, fa.updated_at),
  COALESCE(fa.agreed_price, 0),
  COALESCE(f.distance_km, 0),
  CASE WHEN COALESCE(f.required_trucks, 1) > 0 THEN COALESCE(f.weight, 0) / COALESCE(f.required_trucks, 1) ELSE COALESCE(f.weight, 0) END,
  f.origin_city, f.origin_state, f.destination_city, f.destination_state, f.cargo_type
FROM public.freight_assignments fa
JOIN public.freights f ON f.id = fa.freight_id
WHERE fa.status IN ('COMPLETED', 'DELIVERED')
ON CONFLICT (assignment_id) DO NOTHING;

-- Backfill service_request_history
INSERT INTO public.service_request_history (
  service_request_id, client_id, provider_id, service_type,
  status_final, accepted_at, completed_at, cancelled_at,
  city, state, estimated_price, final_price,
  contact_name, contact_phone, source
)
SELECT
  sr.id, sr.client_id, sr.provider_id, sr.service_type,
  sr.status, sr.accepted_at,
  CASE WHEN sr.status = 'COMPLETED' THEN COALESCE(sr.completed_at, sr.updated_at) ELSE NULL END,
  CASE WHEN sr.status = 'CANCELLED' THEN COALESCE(sr.cancelled_at, sr.updated_at) ELSE NULL END,
  COALESCE(sr.city_name, sr.location_city), COALESCE(sr.state, sr.location_state),
  COALESCE(sr.estimated_price, 0), COALESCE(sr.final_price, sr.estimated_price, 0),
  sr.contact_name, sr.contact_phone, 'BACKFILL'
FROM public.service_requests sr
WHERE sr.status IN ('COMPLETED', 'CANCELLED')
ON CONFLICT (service_request_id) DO NOTHING;
