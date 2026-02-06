
-- ============================================================
-- CORREÇÃO CRÍTICA: Histórico Imutável + Relatórios Automáticos
-- ============================================================

-- 1. TABELA: operation_history (snapshot imutável de operações finalizadas)
CREATE TABLE public.operation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('FREIGHT', 'SERVICE')),
  original_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  user_role TEXT NOT NULL CHECK (user_role IN ('PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA', 'GUEST')),
  guest_contact_name TEXT,
  guest_contact_phone TEXT,
  origin_location TEXT,
  destination_location TEXT,
  service_or_cargo_type TEXT,
  final_price NUMERIC DEFAULT 0,
  truck_count INTEGER DEFAULT 1,
  operation_created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  final_status TEXT NOT NULL DEFAULT 'COMPLETED',
  rating_completed BOOLEAN DEFAULT false,
  snapshot_data JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de unicidade (evitar duplicatas)
CREATE UNIQUE INDEX idx_oh_unique_user 
  ON public.operation_history (original_id, user_role, user_id) 
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_oh_unique_guest 
  ON public.operation_history (original_id, user_role) 
  WHERE user_id IS NULL;

-- Índices de performance
CREATE INDEX idx_oh_user_id ON public.operation_history (user_id);
CREATE INDEX idx_oh_entity_type ON public.operation_history (entity_type);
CREATE INDEX idx_oh_completed_at ON public.operation_history (completed_at DESC);
CREATE INDEX idx_oh_original_id ON public.operation_history (original_id);

-- RLS: somente leitura para dono, sem UPDATE/DELETE
ALTER TABLE public.operation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem próprio histórico"
  ON public.operation_history FOR SELECT
  USING (
    user_id = get_my_profile_id()
    OR (user_id IS NULL AND user_role = 'GUEST')
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'TRANSPORTADORA'
    )
  );

-- INSERT somente via trigger (SECURITY DEFINER)
CREATE POLICY "Sistema insere histórico via trigger"
  ON public.operation_history FOR INSERT
  WITH CHECK (true);

-- SEM policies de UPDATE/DELETE = imutável

-- 2. TABELA: reports_daily_metrics (métricas agregadas por dia)
CREATE TABLE public.reports_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('FREIGHT', 'SERVICE')),
  region TEXT NOT NULL DEFAULT 'N/A',
  total_completed INTEGER DEFAULT 0,
  total_cancelled INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  avg_price NUMERIC DEFAULT 0,
  by_service_type JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_rdm_unique 
  ON public.reports_daily_metrics (metric_date, entity_type, region);

ALTER TABLE public.reports_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados veem métricas"
  ON public.reports_daily_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('TRANSPORTADORA', 'PRODUTOR')
    )
  );

CREATE POLICY "Sistema insere métricas via trigger"
  ON public.reports_daily_metrics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema atualiza métricas via trigger"
  ON public.reports_daily_metrics FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 3. TRIGGER FUNCTION: Registrar conclusão de FRETE
CREATE OR REPLACE FUNCTION public.record_freight_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_origin TEXT;
  v_destination TEXT;
  v_cargo TEXT;
  v_company_owner_id UUID;
BEGIN
  -- Só dispara quando status muda PARA COMPLETED
  IF NEW.status::text != 'COMPLETED' OR OLD.status::text = 'COMPLETED' THEN
    RETURN NEW;
  END IF;

  v_origin := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.origin_city, '') || '/' || COALESCE(NEW.origin_state, '')), '/'),
    NEW.origin_address,
    'N/A'
  );
  v_destination := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.destination_city, '') || '/' || COALESCE(NEW.destination_state, '')), '/'),
    NEW.destination_address,
    'N/A'
  );
  v_cargo := COALESCE(NEW.cargo_type, NEW.service_type, 'FRETE');

  -- Registro para PRODUTOR
  IF NEW.producer_id IS NOT NULL THEN
    INSERT INTO public.operation_history (
      entity_type, original_id, user_id, user_role,
      guest_contact_name, guest_contact_phone,
      origin_location, destination_location,
      service_or_cargo_type, final_price, truck_count,
      operation_created_at, completed_at, final_status,
      snapshot_data
    ) VALUES (
      'FREIGHT', NEW.id, NEW.producer_id, 'PRODUTOR',
      NEW.guest_contact_name, NEW.guest_contact_phone,
      v_origin, v_destination, v_cargo,
      COALESCE(NEW.price, 0),
      COALESCE(NEW.required_trucks, 1),
      NEW.created_at, now(), 'COMPLETED',
      jsonb_build_object(
        'weight', NEW.weight,
        'distance_km', NEW.distance_km,
        'urgency', NEW.urgency::text,
        'is_guest', COALESCE(NEW.is_guest_freight, false),
        'company_id', NEW.company_id,
        'payment_method', NEW.payment_method::text
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Registro para MOTORISTA
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO public.operation_history (
      entity_type, original_id, user_id, user_role,
      origin_location, destination_location,
      service_or_cargo_type, final_price, truck_count,
      operation_created_at, completed_at, final_status,
      snapshot_data
    ) VALUES (
      'FREIGHT', NEW.id, NEW.driver_id, 'MOTORISTA',
      v_origin, v_destination, v_cargo,
      COALESCE(NEW.price, 0),
      COALESCE(NEW.required_trucks, 1),
      NEW.created_at, now(), 'COMPLETED',
      jsonb_build_object(
        'weight', NEW.weight,
        'distance_km', NEW.distance_km,
        'urgency', NEW.urgency::text,
        'company_id', NEW.company_id
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Registro para TRANSPORTADORA (via company_id → profile_id)
  IF NEW.company_id IS NOT NULL THEN
    SELECT profile_id INTO v_company_owner_id
    FROM public.transport_companies
    WHERE id = NEW.company_id;

    IF v_company_owner_id IS NOT NULL THEN
      INSERT INTO public.operation_history (
        entity_type, original_id, user_id, user_role,
        origin_location, destination_location,
        service_or_cargo_type, final_price, truck_count,
        operation_created_at, completed_at, final_status,
        snapshot_data
      ) VALUES (
        'FREIGHT', NEW.id, v_company_owner_id, 'TRANSPORTADORA',
        v_origin, v_destination, v_cargo,
        COALESCE(NEW.price, 0),
        COALESCE(NEW.required_trucks, 1),
        NEW.created_at, now(), 'COMPLETED',
        jsonb_build_object(
          'weight', NEW.weight,
          'distance_km', NEW.distance_km,
          'driver_id', NEW.driver_id,
          'company_id', NEW.company_id
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Registro para GUEST (sem producer_id)
  IF NEW.producer_id IS NULL AND COALESCE(NEW.is_guest_freight, false) = true THEN
    INSERT INTO public.operation_history (
      entity_type, original_id, user_id, user_role,
      guest_contact_name, guest_contact_phone,
      origin_location, destination_location,
      service_or_cargo_type, final_price,
      operation_created_at, completed_at, final_status,
      snapshot_data
    ) VALUES (
      'FREIGHT', NEW.id, NULL, 'GUEST',
      NEW.guest_contact_name, NEW.guest_contact_phone,
      v_origin, v_destination, v_cargo,
      COALESCE(NEW.price, 0),
      NEW.created_at, now(), 'COMPLETED',
      jsonb_build_object(
        'weight', NEW.weight,
        'distance_km', NEW.distance_km,
        'is_guest', true
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Atualizar métricas diárias
  INSERT INTO public.reports_daily_metrics (
    metric_date, entity_type, region,
    total_completed, total_revenue, avg_price,
    by_service_type
  ) VALUES (
    CURRENT_DATE, 'FREIGHT',
    COALESCE(NEW.origin_state, 'N/A'),
    1, COALESCE(NEW.price, 0), COALESCE(NEW.price, 0),
    jsonb_build_object(v_cargo, 1)
  )
  ON CONFLICT (metric_date, entity_type, region)
  DO UPDATE SET
    total_completed = reports_daily_metrics.total_completed + 1,
    total_revenue = reports_daily_metrics.total_revenue + COALESCE(NEW.price, 0),
    avg_price = (reports_daily_metrics.total_revenue + COALESCE(NEW.price, 0)) / 
                NULLIF(reports_daily_metrics.total_completed + 1, 0),
    by_service_type = reports_daily_metrics.by_service_type || 
      jsonb_build_object(v_cargo, COALESCE((reports_daily_metrics.by_service_type ->> v_cargo)::int, 0) + 1),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. TRIGGER FUNCTION: Registrar conclusão de SERVIÇO
CREATE OR REPLACE FUNCTION public.record_service_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_location TEXT;
  v_service TEXT;
  v_client_role TEXT;
  v_final_price NUMERIC;
BEGIN
  -- Só dispara quando status muda PARA COMPLETED
  IF NEW.status != 'COMPLETED' OR COALESCE(OLD.status, '') = 'COMPLETED' THEN
    RETURN NEW;
  END IF;

  v_location := COALESCE(
    NULLIF(TRIM(COALESCE(NEW.city_name, NEW.location_city, '') || '/' || COALESCE(NEW.state, NEW.location_state, '')), '/'),
    NEW.location_address,
    'N/A'
  );
  v_service := COALESCE(NEW.service_type, 'SERVICO');
  v_final_price := COALESCE(NEW.final_price, NEW.estimated_price, 0);

  -- Registro para CLIENTE (se logado)
  IF NEW.client_id IS NOT NULL THEN
    SELECT role::text INTO v_client_role
    FROM public.profiles
    WHERE id = NEW.client_id;

    INSERT INTO public.operation_history (
      entity_type, original_id, user_id, user_role,
      origin_location, destination_location,
      service_or_cargo_type, final_price,
      operation_created_at, completed_at, final_status,
      rating_completed,
      snapshot_data
    ) VALUES (
      'SERVICE', NEW.id, NEW.client_id, COALESCE(v_client_role, 'PRODUTOR'),
      v_location, v_location, v_service,
      v_final_price,
      NEW.created_at, COALESCE(NEW.completed_at, now()), 'COMPLETED',
      (NEW.client_rating IS NOT NULL),
      jsonb_build_object(
        'urgency', NEW.urgency,
        'is_emergency', COALESCE(NEW.is_emergency, false),
        'provider_id', NEW.provider_id
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Registro para GUEST (sem client_id)
  IF NEW.client_id IS NULL THEN
    INSERT INTO public.operation_history (
      entity_type, original_id, user_id, user_role,
      guest_contact_name, guest_contact_phone,
      origin_location, destination_location,
      service_or_cargo_type, final_price,
      operation_created_at, completed_at, final_status,
      snapshot_data
    ) VALUES (
      'SERVICE', NEW.id, NULL, 'GUEST',
      NEW.contact_name, NEW.contact_phone,
      v_location, v_location, v_service,
      v_final_price,
      NEW.created_at, COALESCE(NEW.completed_at, now()), 'COMPLETED',
      jsonb_build_object(
        'urgency', NEW.urgency,
        'is_emergency', COALESCE(NEW.is_emergency, false),
        'is_guest', true
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Registro para PRESTADOR
  IF NEW.provider_id IS NOT NULL THEN
    INSERT INTO public.operation_history (
      entity_type, original_id, user_id, user_role,
      origin_location, destination_location,
      service_or_cargo_type, final_price,
      operation_created_at, completed_at, final_status,
      rating_completed,
      snapshot_data
    ) VALUES (
      'SERVICE', NEW.id, NEW.provider_id, 'PRESTADOR_SERVICOS',
      v_location, v_location, v_service,
      v_final_price,
      NEW.created_at, COALESCE(NEW.completed_at, now()), 'COMPLETED',
      (NEW.provider_rating IS NOT NULL),
      jsonb_build_object(
        'urgency', NEW.urgency,
        'client_id', NEW.client_id,
        'is_emergency', COALESCE(NEW.is_emergency, false)
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Atualizar métricas diárias
  INSERT INTO public.reports_daily_metrics (
    metric_date, entity_type, region,
    total_completed, total_revenue, avg_price,
    by_service_type
  ) VALUES (
    CURRENT_DATE, 'SERVICE',
    COALESCE(NEW.state, NEW.location_state, 'N/A'),
    1, v_final_price, v_final_price,
    jsonb_build_object(v_service, 1)
  )
  ON CONFLICT (metric_date, entity_type, region)
  DO UPDATE SET
    total_completed = reports_daily_metrics.total_completed + 1,
    total_revenue = reports_daily_metrics.total_revenue + v_final_price,
    avg_price = (reports_daily_metrics.total_revenue + v_final_price) / 
                NULLIF(reports_daily_metrics.total_completed + 1, 0),
    by_service_type = reports_daily_metrics.by_service_type || 
      jsonb_build_object(v_service, COALESCE((reports_daily_metrics.by_service_type ->> v_service)::int, 0) + 1),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. CRIAR TRIGGERS
CREATE TRIGGER trg_freight_completion
  AFTER UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION public.record_freight_completion();

CREATE TRIGGER trg_service_completion
  AFTER UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.record_service_completion();

-- 6. RPC: Consultar relatórios agregados por período
CREATE OR REPLACE FUNCTION public.get_operation_report(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start', p_start_date, 'end', p_end_date),
    'totals', (
      SELECT jsonb_build_object(
        'completed', COALESCE(SUM(total_completed), 0),
        'cancelled', COALESCE(SUM(total_cancelled), 0),
        'revenue', COALESCE(SUM(total_revenue), 0),
        'avg_price', CASE WHEN COALESCE(SUM(total_completed), 0) > 0 
          THEN COALESCE(SUM(total_revenue), 0) / SUM(total_completed) 
          ELSE 0 END
      )
      FROM public.reports_daily_metrics
      WHERE metric_date BETWEEN p_start_date AND p_end_date
      AND (p_entity_type IS NULL OR entity_type = p_entity_type)
    ),
    'by_day', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', metric_date,
          'completed', total_completed,
          'revenue', total_revenue
        ) ORDER BY metric_date
      )
      FROM public.reports_daily_metrics
      WHERE metric_date BETWEEN p_start_date AND p_end_date
      AND (p_entity_type IS NULL OR entity_type = p_entity_type)
    ), '[]'::jsonb),
    'by_region', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'region', region,
          'completed', SUM(total_completed),
          'revenue', SUM(total_revenue)
        )
      )
      FROM public.reports_daily_metrics
      WHERE metric_date BETWEEN p_start_date AND p_end_date
      AND (p_entity_type IS NULL OR entity_type = p_entity_type)
      GROUP BY region
    ), '[]'::jsonb),
    'by_type', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'entity_type', entity_type,
          'completed', SUM(total_completed),
          'revenue', SUM(total_revenue)
        )
      )
      FROM public.reports_daily_metrics
      WHERE metric_date BETWEEN p_start_date AND p_end_date
      AND (p_entity_type IS NULL OR entity_type = p_entity_type)
      GROUP BY entity_type
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. RPC: Atualizar flag de avaliação no histórico
CREATE OR REPLACE FUNCTION public.mark_history_rating_completed(
  p_original_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.operation_history
  SET rating_completed = true
  WHERE original_id = p_original_id
  AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. BACKFILL: Registrar operações já concluídas (freights)
INSERT INTO public.operation_history (
  entity_type, original_id, user_id, user_role,
  guest_contact_name, guest_contact_phone,
  origin_location, destination_location,
  service_or_cargo_type, final_price, truck_count,
  operation_created_at, completed_at, final_status,
  snapshot_data
)
SELECT
  'FREIGHT', f.id, f.producer_id, 'PRODUTOR',
  f.guest_contact_name, f.guest_contact_phone,
  COALESCE(NULLIF(TRIM(COALESCE(f.origin_city,'') || '/' || COALESCE(f.origin_state,'')), '/'), f.origin_address, 'N/A'),
  COALESCE(NULLIF(TRIM(COALESCE(f.destination_city,'') || '/' || COALESCE(f.destination_state,'')), '/'), f.destination_address, 'N/A'),
  COALESCE(f.cargo_type, f.service_type, 'FRETE'),
  COALESCE(f.price, 0),
  COALESCE(f.required_trucks, 1),
  f.created_at, COALESCE(f.updated_at, now()), 'COMPLETED',
  jsonb_build_object('weight', f.weight, 'distance_km', f.distance_km, 'backfill', true)
FROM public.freights f
WHERE f.status::text = 'COMPLETED' AND f.producer_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.operation_history (
  entity_type, original_id, user_id, user_role,
  origin_location, destination_location,
  service_or_cargo_type, final_price, truck_count,
  operation_created_at, completed_at, final_status,
  snapshot_data
)
SELECT
  'FREIGHT', f.id, f.driver_id, 'MOTORISTA',
  COALESCE(NULLIF(TRIM(COALESCE(f.origin_city,'') || '/' || COALESCE(f.origin_state,'')), '/'), f.origin_address, 'N/A'),
  COALESCE(NULLIF(TRIM(COALESCE(f.destination_city,'') || '/' || COALESCE(f.destination_state,'')), '/'), f.destination_address, 'N/A'),
  COALESCE(f.cargo_type, f.service_type, 'FRETE'),
  COALESCE(f.price, 0),
  COALESCE(f.required_trucks, 1),
  f.created_at, COALESCE(f.updated_at, now()), 'COMPLETED',
  jsonb_build_object('weight', f.weight, 'distance_km', f.distance_km, 'backfill', true)
FROM public.freights f
WHERE f.status::text = 'COMPLETED' AND f.driver_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill: service_requests concluídos (cliente)
INSERT INTO public.operation_history (
  entity_type, original_id, user_id, user_role,
  origin_location, destination_location,
  service_or_cargo_type, final_price,
  operation_created_at, completed_at, final_status,
  rating_completed, snapshot_data
)
SELECT
  'SERVICE', sr.id, sr.client_id,
  COALESCE((SELECT p.role::text FROM profiles p WHERE p.id = sr.client_id), 'PRODUTOR'),
  COALESCE(NULLIF(TRIM(COALESCE(sr.city_name, sr.location_city, '') || '/' || COALESCE(sr.state, sr.location_state, '')), '/'), sr.location_address, 'N/A'),
  COALESCE(NULLIF(TRIM(COALESCE(sr.city_name, sr.location_city, '') || '/' || COALESCE(sr.state, sr.location_state, '')), '/'), sr.location_address, 'N/A'),
  COALESCE(sr.service_type, 'SERVICO'),
  COALESCE(sr.final_price, sr.estimated_price, 0),
  sr.created_at, COALESCE(sr.completed_at, sr.updated_at, now()), 'COMPLETED',
  (sr.client_rating IS NOT NULL),
  jsonb_build_object('urgency', sr.urgency, 'backfill', true)
FROM public.service_requests sr
WHERE sr.status = 'COMPLETED' AND sr.client_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill: service_requests concluídos (prestador)
INSERT INTO public.operation_history (
  entity_type, original_id, user_id, user_role,
  origin_location, destination_location,
  service_or_cargo_type, final_price,
  operation_created_at, completed_at, final_status,
  rating_completed, snapshot_data
)
SELECT
  'SERVICE', sr.id, sr.provider_id, 'PRESTADOR_SERVICOS',
  COALESCE(NULLIF(TRIM(COALESCE(sr.city_name, sr.location_city, '') || '/' || COALESCE(sr.state, sr.location_state, '')), '/'), sr.location_address, 'N/A'),
  COALESCE(NULLIF(TRIM(COALESCE(sr.city_name, sr.location_city, '') || '/' || COALESCE(sr.state, sr.location_state, '')), '/'), sr.location_address, 'N/A'),
  COALESCE(sr.service_type, 'SERVICO'),
  COALESCE(sr.final_price, sr.estimated_price, 0),
  sr.created_at, COALESCE(sr.completed_at, sr.updated_at, now()), 'COMPLETED',
  (sr.provider_rating IS NOT NULL),
  jsonb_build_object('urgency', sr.urgency, 'backfill', true)
FROM public.service_requests sr
WHERE sr.status = 'COMPLETED' AND sr.provider_id IS NOT NULL
ON CONFLICT DO NOTHING;
