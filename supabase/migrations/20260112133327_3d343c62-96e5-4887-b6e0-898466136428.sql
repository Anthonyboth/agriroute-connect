-- =====================================================
-- PAINEL ANTIFRAUDE VISUAL - TABELAS E FUNÇÕES
-- =====================================================

-- 1. Tabela de eventos de parada detalhados
CREATE TABLE IF NOT EXISTS stop_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id),
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  address TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  reason TEXT,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  is_known_point BOOLEAN DEFAULT FALSE,
  known_point_type TEXT,
  speed_before NUMERIC,
  speed_after NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para stop_events
CREATE INDEX IF NOT EXISTS idx_stop_events_freight ON stop_events(freight_id);
CREATE INDEX IF NOT EXISTS idx_stop_events_driver ON stop_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_stop_events_risk ON stop_events(risk_level);
CREATE INDEX IF NOT EXISTS idx_stop_events_started ON stop_events(started_at);

-- 2. Tabela de desvios de rota
CREATE TABLE IF NOT EXISTS route_deviations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deviation_km NUMERIC NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  expected_lat NUMERIC,
  expected_lng NUMERIC,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'low',
  resolved BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para route_deviations
CREATE INDEX IF NOT EXISTS idx_route_deviations_freight ON route_deviations(freight_id);
CREATE INDEX IF NOT EXISTS idx_route_deviations_severity ON route_deviations(severity);

-- 3. Tabela de incidentes de falso-offline
CREATE TABLE IF NOT EXISTS offline_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  last_known_lat NUMERIC,
  last_known_lng NUMERIC,
  first_return_lat NUMERIC,
  first_return_lng NUMERIC,
  distance_gap_km NUMERIC,
  is_suspicious BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para offline_incidents
CREATE INDEX IF NOT EXISTS idx_offline_incidents_freight ON offline_incidents(freight_id);
CREATE INDEX IF NOT EXISTS idx_offline_incidents_suspicious ON offline_incidents(is_suspicious);

-- 4. Tabela de feedback para aprendizado incremental
CREATE TABLE IF NOT EXISTS antifraud_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID REFERENCES freights(id) ON DELETE SET NULL,
  event_id UUID REFERENCES auditoria_eventos(id) ON DELETE SET NULL,
  stop_event_id UUID REFERENCES stop_events(id) ON DELETE SET NULL,
  confirmed_fraud BOOLEAN,
  feedback_type TEXT CHECK (feedback_type IN ('false_positive', 'true_positive', 'escalate', 'dismissed')),
  notes TEXT,
  reviewer_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para antifraud_feedback
CREATE INDEX IF NOT EXISTS idx_antifraud_feedback_freight ON antifraud_feedback(freight_id);
CREATE INDEX IF NOT EXISTS idx_antifraud_feedback_type ON antifraud_feedback(feedback_type);

-- 5. Adicionar colunas de antifraude ao freights (se não existirem)
ALTER TABLE freights ADD COLUMN IF NOT EXISTS antifraud_score INTEGER DEFAULT 0;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS antifraud_level TEXT CHECK (antifraud_level IN ('normal', 'attention', 'high_risk'));
ALTER TABLE freights ADD COLUMN IF NOT EXISTS total_stop_time_minutes INTEGER DEFAULT 0;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS total_offline_time_minutes INTEGER DEFAULT 0;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS route_deviation_max_km NUMERIC DEFAULT 0;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS antifraud_analyzed_at TIMESTAMPTZ;

-- 6. Função para calcular score de antifraude determinístico
CREATE OR REPLACE FUNCTION calculate_freight_antifraud_score(p_freight_id UUID)
RETURNS TABLE(
  score INTEGER,
  level TEXT,
  stops_count INTEGER,
  stop_time_minutes INTEGER,
  offline_minutes INTEGER,
  deviation_km NUMERIC,
  high_risk_stops INTEGER
) AS $$
DECLARE
  v_score INTEGER := 0;
  v_stops_count INTEGER := 0;
  v_stop_time_minutes INTEGER := 0;
  v_offline_minutes INTEGER := 0;
  v_deviation_km NUMERIC := 0;
  v_high_risk_stops INTEGER := 0;
  v_level TEXT := 'normal';
BEGIN
  SELECT 
    COUNT(*)::INTEGER, 
    COALESCE(SUM(se.duration_minutes), 0)::INTEGER,
    COUNT(*) FILTER (WHERE se.risk_level IN ('high', 'critical'))::INTEGER
  INTO v_stops_count, v_stop_time_minutes, v_high_risk_stops
  FROM stop_events se
  WHERE se.freight_id = p_freight_id;
  
  SELECT COALESCE(SUM(oi.duration_minutes), 0)::INTEGER
  INTO v_offline_minutes
  FROM offline_incidents oi
  WHERE oi.freight_id = p_freight_id;
  
  SELECT COALESCE(MAX(rd.deviation_km), 0)
  INTO v_deviation_km
  FROM route_deviations rd
  WHERE rd.freight_id = p_freight_id;
  
  v_score := (v_stops_count * 10)
           + (v_stop_time_minutes * 0.5)::INTEGER
           + (v_deviation_km * 3)::INTEGER
           + (v_offline_minutes * 0.7)::INTEGER
           + (v_high_risk_stops * 15);
  
  v_score := LEAST(GREATEST(v_score, 0), 100);
  
  IF v_score >= 70 THEN
    v_level := 'high_risk';
  ELSIF v_score >= 40 THEN
    v_level := 'attention';
  ELSE
    v_level := 'normal';
  END IF;
  
  UPDATE freights 
  SET 
    antifraud_score = v_score,
    antifraud_level = v_level,
    total_stop_time_minutes = v_stop_time_minutes,
    total_offline_time_minutes = v_offline_minutes,
    route_deviation_max_km = v_deviation_km,
    antifraud_analyzed_at = NOW()
  WHERE id = p_freight_id;
  
  RETURN QUERY SELECT 
    v_score, 
    v_level, 
    v_stops_count, 
    v_stop_time_minutes, 
    v_offline_minutes, 
    v_deviation_km,
    v_high_risk_stops;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para classificar parada automaticamente
CREATE OR REPLACE FUNCTION classify_stop_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
  END IF;
  
  IF NEW.duration_minutes IS NOT NULL THEN
    NEW.risk_level := CASE
      WHEN NEW.duration_minutes >= 60 THEN 'critical'
      WHEN NEW.duration_minutes >= 30 THEN 'high'
      WHEN NEW.duration_minutes >= 15 THEN 'medium'
      ELSE 'low'
    END;
    
    IF NEW.reason IS NULL THEN
      NEW.reason := CASE
        WHEN NEW.duration_minutes >= 60 THEN 'Parada muito prolongada fora de ponto logístico'
        WHEN NEW.duration_minutes >= 30 THEN 'Parada prolongada fora de ponto logístico'
        WHEN NEW.duration_minutes >= 15 THEN 'Parada incomum detectada'
        ELSE 'Parada breve registrada'
      END;
    END IF;
  END IF;
  
  IF NEW.is_known_point = TRUE THEN
    NEW.risk_level := 'low';
    NEW.reason := COALESCE(NEW.known_point_type, 'ponto_conhecido') || ' - parada autorizada';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_classify_stop_event ON stop_events;
CREATE TRIGGER trigger_classify_stop_event
  BEFORE INSERT OR UPDATE ON stop_events
  FOR EACH ROW
  EXECUTE FUNCTION classify_stop_event();

-- 8. Função para detectar incidente offline suspeito
CREATE OR REPLACE FUNCTION check_offline_suspicious()
RETURNS TRIGGER AS $$
DECLARE
  v_max_speed_kmh NUMERIC := 100;
  v_max_possible_distance NUMERIC;
BEGIN
  IF NEW.last_known_lat IS NOT NULL 
     AND NEW.first_return_lat IS NOT NULL 
     AND NEW.duration_minutes IS NOT NULL THEN
    
    NEW.distance_gap_km := 111.12 * SQRT(
      POWER(NEW.first_return_lat - NEW.last_known_lat, 2) +
      POWER((NEW.first_return_lng - NEW.last_known_lng) * COS(RADIANS(NEW.last_known_lat)), 2)
    );
    
    v_max_possible_distance := (NEW.duration_minutes / 60.0) * v_max_speed_kmh;
    
    IF NEW.distance_gap_km > (v_max_possible_distance * 1.5) THEN
      NEW.is_suspicious := TRUE;
    ELSE
      NEW.is_suspicious := FALSE;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_offline_suspicious ON offline_incidents;
CREATE TRIGGER trigger_check_offline_suspicious
  BEFORE INSERT OR UPDATE ON offline_incidents
  FOR EACH ROW
  EXECUTE FUNCTION check_offline_suspicious();

-- 9. RLS Policies
ALTER TABLE stop_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_deviations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE antifraud_feedback ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has admin or service_provider role
CREATE OR REPLACE FUNCTION public.is_antifraud_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'service_provider'::app_role)
  )
$$;

-- Políticas para stop_events
CREATE POLICY "stop_events_select_policy" ON stop_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM freights f 
      WHERE f.id = stop_events.freight_id 
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
    OR public.is_antifraud_viewer(auth.uid())
  );

CREATE POLICY "stop_events_insert_policy" ON stop_events
  FOR INSERT WITH CHECK (
    driver_id = auth.uid()
    OR public.is_antifraud_viewer(auth.uid())
  );

-- Políticas para route_deviations
CREATE POLICY "route_deviations_select_policy" ON route_deviations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM freights f 
      WHERE f.id = route_deviations.freight_id 
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
    OR public.is_antifraud_viewer(auth.uid())
  );

CREATE POLICY "route_deviations_insert_policy" ON route_deviations
  FOR INSERT WITH CHECK (
    public.is_antifraud_viewer(auth.uid())
  );

-- Políticas para offline_incidents
CREATE POLICY "offline_incidents_select_policy" ON offline_incidents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM freights f 
      WHERE f.id = offline_incidents.freight_id 
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    )
    OR public.is_antifraud_viewer(auth.uid())
  );

CREATE POLICY "offline_incidents_insert_policy" ON offline_incidents
  FOR INSERT WITH CHECK (
    driver_id = auth.uid()
    OR public.is_antifraud_viewer(auth.uid())
  );

-- Políticas para antifraud_feedback
CREATE POLICY "antifraud_feedback_select_policy" ON antifraud_feedback
  FOR SELECT USING (
    reviewer_id = auth.uid()
    OR public.is_antifraud_viewer(auth.uid())
  );

CREATE POLICY "antifraud_feedback_insert_policy" ON antifraud_feedback
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    OR public.is_antifraud_viewer(auth.uid())
  );

-- 10. Grant permissions
GRANT SELECT, INSERT ON stop_events TO authenticated;
GRANT SELECT, INSERT ON route_deviations TO authenticated;
GRANT SELECT, INSERT ON offline_incidents TO authenticated;
GRANT SELECT, INSERT ON antifraud_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_freight_antifraud_score TO authenticated;
GRANT EXECUTE ON FUNCTION is_antifraud_viewer TO authenticated;