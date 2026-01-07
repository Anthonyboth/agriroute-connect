-- ============================================================
-- MIGRAÇÃO: Documentação Sanitária + ETA + Alertas + Histórico
-- ============================================================

-- 1. Tabela de documentos sanitários (GTA, etc.)
CREATE TABLE IF NOT EXISTS public.freight_sanitary_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('GTA', 'GTA_A', 'GTA_B', 'CERTIFICADO_SANITARIO', 'OUTROS')),
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  animal_count INTEGER,
  origin_property TEXT,
  destination_property TEXT,
  issuing_agency TEXT,
  file_url TEXT,
  ocr_extracted_data JSONB,
  ocr_confidence NUMERIC(5,2),
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'expired')),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_freight_sanitary_documents_freight ON public.freight_sanitary_documents(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_sanitary_documents_type ON public.freight_sanitary_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_freight_sanitary_documents_status ON public.freight_sanitary_documents(validation_status);

-- RLS
ALTER TABLE public.freight_sanitary_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver documentos dos seus fretes"
ON public.freight_sanitary_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_sanitary_documents.freight_id
    AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
  )
);

CREATE POLICY "Usuários podem inserir documentos nos seus fretes"
ON public.freight_sanitary_documents FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_sanitary_documents.freight_id
    AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
  )
);

CREATE POLICY "Usuários podem atualizar documentos dos seus fretes"
ON public.freight_sanitary_documents FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_sanitary_documents.freight_id
    AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
  )
);

-- 2. Campos adicionais em freights para compliance de carga viva
ALTER TABLE public.freights 
  ADD COLUMN IF NOT EXISTS requires_sanitary_docs BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sanitary_compliance_status TEXT DEFAULT 'not_required' 
    CHECK (sanitary_compliance_status IN ('not_required', 'pending', 'partial', 'complete', 'expired')),
  ADD COLUMN IF NOT EXISTS cargo_category TEXT,
  ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eta_average_speed_kmh NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS eta_remaining_distance_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS delay_alert_status TEXT DEFAULT 'normal'
    CHECK (delay_alert_status IN ('normal', 'warning', 'critical', 'stopped', 'deviation'));

-- 3. Tabela para alertas de atraso
CREATE TABLE IF NOT EXISTS public.freight_delay_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('stopped', 'deviation', 'slow_progress', 'eta_exceeded', 'no_signal')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  metadata JSONB,
  notified_producer BOOLEAN DEFAULT false,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freight_delay_alerts_freight ON public.freight_delay_alerts(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_delay_alerts_status ON public.freight_delay_alerts(resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE public.freight_delay_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtor pode ver alertas dos seus fretes"
ON public.freight_delay_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_delay_alerts.freight_id
    AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
  )
);

CREATE POLICY "Sistema pode inserir alertas"
ON public.freight_delay_alerts FOR INSERT
WITH CHECK (true);

-- 4. Tabela para histórico de rotas (replay visual)
CREATE TABLE IF NOT EXISTS public.freight_route_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  driver_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  accuracy NUMERIC(8,2),
  speed NUMERIC(6,2),
  heading NUMERIC(5,2),
  altitude NUMERIC(8,2),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  distance_from_start_km NUMERIC(10,2),
  distance_to_destination_km NUMERIC(10,2),
  segment_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices otimizados para replay e queries
CREATE INDEX IF NOT EXISTS idx_freight_route_history_freight ON public.freight_route_history(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_route_history_time ON public.freight_route_history(freight_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_freight_route_history_driver ON public.freight_route_history(driver_profile_id);

ALTER TABLE public.freight_route_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtor e motorista podem ver histórico de rota"
ON public.freight_route_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_route_history.freight_id
    AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
  )
);

CREATE POLICY "Motorista pode inserir pontos de rota"
ON public.freight_route_history FOR INSERT
WITH CHECK (
  driver_profile_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_route_history.freight_id
    AND f.driver_id = auth.uid()
  )
);

-- 5. Função RPC para calcular ETA inteligente
CREATE OR REPLACE FUNCTION public.calculate_freight_eta(
  p_freight_id UUID,
  p_current_lat NUMERIC,
  p_current_lng NUMERIC,
  p_current_speed_kmh NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
  v_avg_speed NUMERIC;
  v_remaining_distance NUMERIC;
  v_eta_hours NUMERIC;
  v_eta TIMESTAMPTZ;
  v_recent_speeds NUMERIC[];
BEGIN
  -- Buscar dados do frete
  SELECT destination_lat, destination_lng, distance_km, status
  INTO v_freight
  FROM freights
  WHERE id = p_freight_id;
  
  IF v_freight IS NULL THEN
    RETURN jsonb_build_object('error', 'Frete não encontrado');
  END IF;
  
  -- Calcular distância restante (fórmula Haversine simplificada)
  v_remaining_distance := 111.12 * sqrt(
    power(v_freight.destination_lat - p_current_lat, 2) + 
    power((v_freight.destination_lng - p_current_lng) * cos(radians(p_current_lat)), 2)
  );
  
  -- Buscar velocidade média das últimas atualizações do motorista
  SELECT array_agg(speed)
  INTO v_recent_speeds
  FROM (
    SELECT speed
    FROM freight_route_history
    WHERE freight_id = p_freight_id
      AND speed > 5 -- Ignorar paradas
      AND captured_at > now() - interval '2 hours'
    ORDER BY captured_at DESC
    LIMIT 20
  ) recent;
  
  -- Calcular velocidade média
  IF v_recent_speeds IS NOT NULL AND array_length(v_recent_speeds, 1) > 0 THEN
    SELECT avg(s) INTO v_avg_speed FROM unnest(v_recent_speeds) s;
  ELSIF p_current_speed_kmh IS NOT NULL AND p_current_speed_kmh > 5 THEN
    v_avg_speed := p_current_speed_kmh;
  ELSE
    v_avg_speed := 60; -- Velocidade padrão se não houver dados
  END IF;
  
  -- Calcular ETA
  IF v_avg_speed > 0 THEN
    v_eta_hours := v_remaining_distance / v_avg_speed;
    v_eta := now() + (v_eta_hours || ' hours')::interval;
  ELSE
    v_eta := NULL;
  END IF;
  
  -- Atualizar frete
  UPDATE freights
  SET 
    estimated_arrival_at = v_eta,
    eta_calculated_at = now(),
    eta_average_speed_kmh = v_avg_speed,
    eta_remaining_distance_km = v_remaining_distance
  WHERE id = p_freight_id;
  
  RETURN jsonb_build_object(
    'eta', v_eta,
    'remaining_distance_km', round(v_remaining_distance::numeric, 2),
    'average_speed_kmh', round(v_avg_speed::numeric, 1),
    'eta_hours', round(v_eta_hours::numeric, 2)
  );
END;
$$;

-- 6. Função RPC para detectar alertas de atraso
CREATE OR REPLACE FUNCTION public.detect_freight_delay_alerts(p_freight_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freight RECORD;
  v_last_location RECORD;
  v_time_since_update INTERVAL;
  v_alert_type TEXT;
  v_severity TEXT;
  v_message TEXT;
  v_alerts_created INT := 0;
BEGIN
  -- Buscar dados do frete
  SELECT id, status, last_location_update, current_lat, current_lng, 
         estimated_arrival_at, pickup_date, delay_alert_status
  INTO v_freight
  FROM freights
  WHERE id = p_freight_id;
  
  IF v_freight IS NULL THEN
    RETURN jsonb_build_object('error', 'Frete não encontrado');
  END IF;
  
  -- Calcular tempo desde última atualização
  v_time_since_update := now() - COALESCE(v_freight.last_location_update, now() - interval '999 days');
  
  -- Verificar se motorista está parado há muito tempo (>30 min)
  IF v_time_since_update > interval '30 minutes' AND v_freight.status IN ('in_transit', 'em_transito') THEN
    -- Verificar se já não existe alerta ativo
    IF NOT EXISTS (
      SELECT 1 FROM freight_delay_alerts 
      WHERE freight_id = p_freight_id 
        AND alert_type = 'stopped'
        AND resolved_at IS NULL
    ) THEN
      v_alert_type := 'stopped';
      v_severity := CASE 
        WHEN v_time_since_update > interval '2 hours' THEN 'critical'
        WHEN v_time_since_update > interval '1 hour' THEN 'warning'
        ELSE 'info'
      END;
      v_message := 'Motorista parado há ' || 
        extract(epoch from v_time_since_update)::int / 60 || ' minutos';
      
      INSERT INTO freight_delay_alerts (freight_id, alert_type, severity, message, location_lat, location_lng)
      VALUES (p_freight_id, v_alert_type, v_severity, v_message, v_freight.current_lat, v_freight.current_lng);
      
      v_alerts_created := v_alerts_created + 1;
      
      -- Atualizar status do frete
      UPDATE freights SET delay_alert_status = 'stopped' WHERE id = p_freight_id;
    END IF;
  END IF;
  
  -- Verificar sem sinal (>2 horas)
  IF v_time_since_update > interval '2 hours' AND v_freight.status IN ('in_transit', 'em_transito') THEN
    IF NOT EXISTS (
      SELECT 1 FROM freight_delay_alerts 
      WHERE freight_id = p_freight_id 
        AND alert_type = 'no_signal'
        AND resolved_at IS NULL
    ) THEN
      INSERT INTO freight_delay_alerts (freight_id, alert_type, severity, message)
      VALUES (p_freight_id, 'no_signal', 'critical', 'Sem sinal GPS há mais de 2 horas');
      
      v_alerts_created := v_alerts_created + 1;
    END IF;
  END IF;
  
  -- Verificar ETA excedido
  IF v_freight.estimated_arrival_at IS NOT NULL 
     AND v_freight.estimated_arrival_at < now()
     AND v_freight.status IN ('in_transit', 'em_transito') THEN
    IF NOT EXISTS (
      SELECT 1 FROM freight_delay_alerts 
      WHERE freight_id = p_freight_id 
        AND alert_type = 'eta_exceeded'
        AND resolved_at IS NULL
    ) THEN
      INSERT INTO freight_delay_alerts (freight_id, alert_type, severity, message)
      VALUES (p_freight_id, 'eta_exceeded', 'warning', 'Previsão de chegada excedida');
      
      v_alerts_created := v_alerts_created + 1;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'alerts_created', v_alerts_created,
    'freight_id', p_freight_id,
    'checked_at', now()
  );
END;
$$;

-- 7. Função RPC para inserir ponto no histórico de rota
CREATE OR REPLACE FUNCTION public.insert_route_point(
  p_freight_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_accuracy NUMERIC DEFAULT NULL,
  p_speed NUMERIC DEFAULT NULL,
  p_heading NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_freight RECORD;
  v_last_point RECORD;
  v_distance_from_start NUMERIC;
  v_distance_to_dest NUMERIC;
  v_point_id UUID;
BEGIN
  -- Verificar se o usuário é o motorista do frete
  SELECT driver_id, origin_lat, origin_lng, destination_lat, destination_lng
  INTO v_freight
  FROM freights
  WHERE id = p_freight_id;
  
  IF v_freight.driver_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Não autorizado');
  END IF;
  
  -- Calcular distâncias
  IF v_freight.origin_lat IS NOT NULL THEN
    v_distance_from_start := 111.12 * sqrt(
      power(p_lat - v_freight.origin_lat, 2) + 
      power((p_lng - v_freight.origin_lng) * cos(radians(p_lat)), 2)
    );
  END IF;
  
  IF v_freight.destination_lat IS NOT NULL THEN
    v_distance_to_dest := 111.12 * sqrt(
      power(v_freight.destination_lat - p_lat, 2) + 
      power((v_freight.destination_lng - p_lng) * cos(radians(p_lat)), 2)
    );
  END IF;
  
  -- Inserir ponto
  INSERT INTO freight_route_history (
    freight_id, driver_profile_id, lat, lng, accuracy, speed, heading,
    distance_from_start_km, distance_to_destination_km
  )
  VALUES (
    p_freight_id, auth.uid(), p_lat, p_lng, p_accuracy, p_speed, p_heading,
    v_distance_from_start, v_distance_to_dest
  )
  RETURNING id INTO v_point_id;
  
  -- Calcular ETA automaticamente
  PERFORM calculate_freight_eta(p_freight_id, p_lat, p_lng, p_speed);
  
  RETURN jsonb_build_object(
    'success', true,
    'point_id', v_point_id,
    'distance_to_destination_km', round(v_distance_to_dest::numeric, 2)
  );
END;
$$;

-- 8. Trigger para atualizar updated_at em freight_sanitary_documents
CREATE OR REPLACE FUNCTION update_freight_sanitary_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_freight_sanitary_docs ON freight_sanitary_documents;
CREATE TRIGGER trigger_update_freight_sanitary_docs
  BEFORE UPDATE ON freight_sanitary_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_freight_sanitary_docs_updated_at();

-- 9. Habilitar realtime para novas tabelas
ALTER TABLE public.freight_delay_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.freight_route_history REPLICA IDENTITY FULL;

-- Adicionar à publicação se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'freight_delay_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_delay_alerts;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'freight_route_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_route_history;
  END IF;
END $$;