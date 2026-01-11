-- =====================================================
-- ANTIFRAUD SYSTEM + ENHANCED COMPLIANCE SCHEMA
-- Includes: ETA history, alerts, stops, events, feedback
-- Plus: Haversine functions, risk scoring, expiry automation
-- =====================================================

-- 1. FREIGHT ETA HISTORY - Track ETA changes over time
CREATE TABLE IF NOT EXISTS public.freight_eta_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  eta_minutes INTEGER,
  remaining_distance_km NUMERIC(10,2),
  avg_speed_kmh NUMERIC(6,2),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'system'
);

-- 2. FREIGHT ALERTS - Antifraud and compliance alerts
CREATE TABLE IF NOT EXISTS public.freight_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'ETA_WORSENED', 'SUSPICIOUS_STOP', 'ROUTE_DEVIATION', 
    'OFFLINE_EXCESSIVE', 'SPEED_ANOMALY', 'GTA_EXPIRING',
    'COMPLIANCE_BLOCKED', 'FRAUD_DETECTED'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  previous_value JSONB,
  new_value JSONB,
  message TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FREIGHT STOPS - Track vehicle stops for analysis
CREATE TABLE IF NOT EXISTS public.freight_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  driver_profile_id UUID REFERENCES public.profiles(id),
  lat NUMERIC(10,7) NOT NULL,
  lng NUMERIC(10,7) NOT NULL,
  address TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  classified_as TEXT DEFAULT 'unknown' CHECK (classified_as IN ('normal', 'suspicious', 'critical', 'authorized', 'unknown')),
  risk_score INTEGER DEFAULT 0,
  is_authorized BOOLEAN DEFAULT false,
  authorization_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. FREIGHT EVENTS - Observability events for tracking
CREATE TABLE IF NOT EXISTS public.freight_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  driver_profile_id UUID REFERENCES public.profiles(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'driver_online', 'driver_offline', 'gps_update', 
    'suspicious_stop', 'route_started', 'route_completed',
    'eta_updated', 'alert_triggered', 'compliance_checked'
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. FREIGHT FEEDBACK - ML learning from admin/producer feedback
CREATE TABLE IF NOT EXISTS public.freight_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id),
  reviewer_role TEXT CHECK (reviewer_role IN ('producer', 'admin', 'system')),
  label TEXT NOT NULL CHECK (label IN ('normal', 'suspicious', 'fraud', 'false_positive')),
  alert_id UUID REFERENCES public.freight_alerts(id),
  stop_id UUID REFERENCES public.freight_stops(id),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. INSPECTION ACCESS LOGS - LGPD-compliant access logging
CREATE TABLE IF NOT EXISTS public.inspection_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_hash TEXT NOT NULL,
  freight_id UUID REFERENCES public.freights(id) ON DELETE SET NULL,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address INET,
  user_agent TEXT,
  geo_location JSONB,
  access_granted BOOLEAN DEFAULT true,
  denial_reason TEXT,
  data_categories_accessed TEXT[] DEFAULT ARRAY['transport', 'compliance', 'animal']
);

-- 7. Add columns to freights table for antifraud
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS region_code TEXT;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS total_stop_minutes INTEGER DEFAULT 0;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS total_distance_km NUMERIC(10,2);
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS offline_minutes INTEGER DEFAULT 0;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS last_eta_minutes INTEGER;

-- =====================================================
-- INDEXES for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_freight_eta_history_freight ON public.freight_eta_history(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_eta_history_calculated ON public.freight_eta_history(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_freight_alerts_freight ON public.freight_alerts(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_alerts_type ON public.freight_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_freight_alerts_unresolved ON public.freight_alerts(freight_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_freight_stops_freight ON public.freight_stops(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_stops_suspicious ON public.freight_stops(freight_id) WHERE classified_as IN ('suspicious', 'critical');
CREATE INDEX IF NOT EXISTS idx_freight_stops_duration ON public.freight_stops(duration_minutes DESC);

CREATE INDEX IF NOT EXISTS idx_freight_events_freight ON public.freight_events(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_events_type ON public.freight_events(event_type);
CREATE INDEX IF NOT EXISTS idx_freight_events_created ON public.freight_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_freight_feedback_freight ON public.freight_feedback(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_feedback_label ON public.freight_feedback(label);

CREATE INDEX IF NOT EXISTS idx_inspection_access_logs_hash ON public.inspection_access_logs(qr_code_hash);
CREATE INDEX IF NOT EXISTS idx_inspection_access_logs_freight ON public.inspection_access_logs(freight_id);
CREATE INDEX IF NOT EXISTS idx_inspection_access_logs_accessed ON public.inspection_access_logs(accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_freights_risk_score ON public.freights(risk_score DESC) WHERE risk_score > 30;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.freight_eta_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_access_logs ENABLE ROW LEVEL SECURITY;

-- freight_eta_history: Read by involved parties, insert by system
CREATE POLICY "ETA history viewable by freight participants"
  ON public.freight_eta_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = freight_eta_history.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System inserts ETA history"
  ON public.freight_eta_history FOR INSERT
  WITH CHECK (true);

-- freight_alerts: Read by involved, admin can resolve
CREATE POLICY "Alerts viewable by freight participants"
  ON public.freight_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = freight_alerts.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System creates alerts"
  ON public.freight_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin resolves alerts"
  ON public.freight_alerts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- freight_stops: Read by involved, system inserts
CREATE POLICY "Stops viewable by freight participants"
  ON public.freight_stops FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = freight_stops.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System inserts stops"
  ON public.freight_stops FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System updates stops"
  ON public.freight_stops FOR UPDATE
  USING (true);

-- freight_events: Read by involved, system inserts
CREATE POLICY "Events viewable by freight participants"
  ON public.freight_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f
      WHERE f.id = freight_events.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "System inserts events"
  ON public.freight_events FOR INSERT
  WITH CHECK (true);

-- freight_feedback: Admins only
CREATE POLICY "Feedback viewable by admin"
  ON public.freight_feedback FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR reviewer_id = auth.uid());

CREATE POLICY "Admins create feedback"
  ON public.freight_feedback FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- inspection_access_logs: Public insert (for logging), admin read
CREATE POLICY "Log inspection access"
  ON public.inspection_access_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin views access logs"
  ON public.inspection_access_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- SQL FUNCTIONS
-- =====================================================

-- Haversine distance function (km)
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  r INTEGER := 6371;
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate ETA based on remaining distance and average speed
CREATE OR REPLACE FUNCTION public.calculate_eta_minutes(
  p_freight_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_remaining_km NUMERIC;
  v_avg_speed NUMERIC;
  v_last_lat NUMERIC;
  v_last_lng NUMERIC;
  v_dest_lat NUMERIC;
  v_dest_lng NUMERIC;
BEGIN
  SELECT f.current_lat, f.current_lng, f.destination_lat, f.destination_lng
  INTO v_last_lat, v_last_lng, v_dest_lat, v_dest_lng
  FROM public.freights f WHERE f.id = p_freight_id;

  IF v_last_lat IS NULL OR v_dest_lat IS NULL THEN RETURN NULL; END IF;

  v_remaining_km := public.haversine_km(v_last_lat, v_last_lng, v_dest_lat, v_dest_lng);

  SELECT COALESCE(AVG(speed), 40) INTO v_avg_speed
  FROM public.driver_location_history
  WHERE freight_id = p_freight_id AND captured_at > now() - INTERVAL '30 minutes'
    AND speed IS NOT NULL AND speed > 5;

  IF v_avg_speed < 10 THEN v_avg_speed := 40; END IF;

  RETURN CEIL((v_remaining_km / v_avg_speed) * 60);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Detect ETA worsening
CREATE OR REPLACE FUNCTION public.detect_eta_worsening(
  p_freight_id UUID,
  p_threshold_minutes INTEGER DEFAULT 20
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_eta INTEGER;
  v_previous_eta INTEGER;
BEGIN
  SELECT eta_minutes INTO v_current_eta FROM public.freight_eta_history
  WHERE freight_id = p_freight_id ORDER BY calculated_at DESC LIMIT 1;

  SELECT eta_minutes INTO v_previous_eta FROM public.freight_eta_history
  WHERE freight_id = p_freight_id ORDER BY calculated_at DESC OFFSET 1 LIMIT 1;

  IF v_current_eta IS NULL OR v_previous_eta IS NULL THEN RETURN FALSE; END IF;

  RETURN (v_current_eta - v_previous_eta) > p_threshold_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Classify stop risk
CREATE OR REPLACE FUNCTION public.classify_stop(
  p_duration_minutes INTEGER,
  p_is_authorized BOOLEAN
) RETURNS TEXT AS $$
BEGIN
  IF p_is_authorized THEN RETURN 'authorized';
  ELSIF p_duration_minutes <= 15 THEN RETURN 'normal';
  ELSIF p_duration_minutes <= 60 THEN RETURN 'suspicious';
  ELSE RETURN 'critical';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate freight risk score
CREATE OR REPLACE FUNCTION public.calculate_freight_risk_score(p_freight_id UUID) RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_stop_score INTEGER := 0;
  v_eta_score INTEGER := 0;
  v_offline_score INTEGER := 0;
  v_compliance_score INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN classified_as = 'critical' THEN 20 WHEN classified_as = 'suspicious' THEN 10 ELSE 0 END), 0)
  INTO v_stop_score FROM public.freight_stops WHERE freight_id = p_freight_id AND NOT is_authorized;
  v_stop_score := LEAST(v_stop_score, 40);

  IF public.detect_eta_worsening(p_freight_id, 30) THEN v_eta_score := 20;
  ELSIF public.detect_eta_worsening(p_freight_id, 20) THEN v_eta_score := 10;
  END IF;

  SELECT COALESCE(offline_minutes, 0) INTO v_offline_score FROM public.freights WHERE id = p_freight_id;
  v_offline_score := LEAST(v_offline_score / 10, 20);

  SELECT COALESCE(risk_score, 0) INTO v_compliance_score FROM public.livestock_freight_compliance WHERE freight_id = p_freight_id;
  v_compliance_score := LEAST(v_compliance_score / 5, 20);

  v_score := v_stop_score + v_eta_score + v_offline_score + v_compliance_score;
  
  UPDATE public.freights SET risk_score = LEAST(v_score, 100) WHERE id = p_freight_id;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Run compliance expiry check (called by cron)
CREATE OR REPLACE FUNCTION public.run_compliance_expiry_check() RETURNS JSONB AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  UPDATE public.livestock_freight_compliance lfc
  SET compliance_status = 'expired', updated_at = now(),
      blocking_reasons = blocking_reasons || jsonb_build_array(jsonb_build_object(
        'type', 'expired_gta', 'severity', 'blocking',
        'message', 'GTA expirada automaticamente pelo sistema', 'expired_at', now()
      ))
  FROM public.freight_sanitary_documents fsd
  WHERE lfc.gta_document_id = fsd.id AND fsd.expiry_date < now()
    AND lfc.compliance_status NOT IN ('expired', 'blocked');

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  INSERT INTO public.freight_alerts (freight_id, alert_type, severity, message, new_value)
  SELECT lfc.freight_id, 'GTA_EXPIRING', 'warning', 'GTA expira em menos de 24 horas',
         jsonb_build_object('expiry_date', fsd.expiry_date)
  FROM public.livestock_freight_compliance lfc
  JOIN public.freight_sanitary_documents fsd ON lfc.gta_document_id = fsd.id
  WHERE fsd.expiry_date > now() AND fsd.expiry_date < now() + INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.freight_alerts fa
      WHERE fa.freight_id = lfc.freight_id AND fa.alert_type = 'GTA_EXPIRING'
        AND fa.created_at > now() - INTERVAL '24 hours'
    );

  RETURN jsonb_build_object('success', true, 'records_expired', v_expired_count, 'executed_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Log compliance event
CREATE OR REPLACE FUNCTION public.log_compliance_event(
  p_freight_id UUID, p_livestock_compliance_id UUID, p_event_type TEXT,
  p_event_category TEXT, p_event_data JSONB DEFAULT '{}'::jsonb,
  p_previous_state JSONB DEFAULT NULL, p_new_state JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.compliance_audit_events (
    freight_id, livestock_compliance_id, event_type, event_category,
    event_data, previous_state, new_state, actor_id
  ) VALUES (
    p_freight_id, p_livestock_compliance_id, p_event_type, p_event_category,
    p_event_data, p_previous_state, p_new_state, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Log inspection access (LGPD compliant)
CREATE OR REPLACE FUNCTION public.log_inspection_access(
  p_qr_code_hash TEXT, p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL, p_access_granted BOOLEAN DEFAULT true,
  p_denial_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID; v_freight_id UUID;
BEGIN
  SELECT freight_id INTO v_freight_id FROM public.inspection_qr_codes
  WHERE qr_code_hash = p_qr_code_hash AND is_active = true AND expires_at > now();

  INSERT INTO public.inspection_access_logs (
    qr_code_hash, freight_id, ip_address, user_agent, access_granted, denial_reason
  ) VALUES (p_qr_code_hash, v_freight_id, p_ip_address, p_user_agent, p_access_granted, p_denial_reason)
  RETURNING id INTO v_id;

  UPDATE public.inspection_qr_codes
  SET access_count = access_count + 1, last_accessed_at = now(), last_accessed_by_ip = p_ip_address
  WHERE qr_code_hash = p_qr_code_hash;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- TRIGGER: Auto-classify stops
CREATE OR REPLACE FUNCTION public.auto_classify_stop() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.duration_minutes IS NOT NULL AND NEW.classified_as = 'unknown' THEN
    NEW.classified_as := public.classify_stop(NEW.duration_minutes, NEW.is_authorized);
    NEW.risk_score := CASE NEW.classified_as
      WHEN 'critical' THEN 50 WHEN 'suspicious' THEN 25 WHEN 'normal' THEN 5 ELSE 0
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_classify_stop ON public.freight_stops;
CREATE TRIGGER trigger_auto_classify_stop
  BEFORE INSERT OR UPDATE OF duration_minutes ON public.freight_stops
  FOR EACH ROW EXECUTE FUNCTION public.auto_classify_stop();

-- TRIGGER: Block freight on critical compliance
CREATE OR REPLACE FUNCTION public.block_freight_on_compliance_issue() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.compliance_status IN ('blocked', 'expired') AND OLD.compliance_status NOT IN ('blocked', 'expired') THEN
    INSERT INTO public.freight_alerts (freight_id, alert_type, severity, message, previous_value, new_value)
    VALUES (NEW.freight_id, 'COMPLIANCE_BLOCKED', 'critical',
      'Frete bloqueado por pendência de compliance sanitário',
      jsonb_build_object('status', OLD.compliance_status),
      jsonb_build_object('status', NEW.compliance_status, 'blocking_reasons', NEW.blocking_reasons));

    PERFORM public.log_compliance_event(NEW.freight_id, NEW.id, 'freight_blocked', 'blocking',
      jsonb_build_object('reason', NEW.compliance_status, 'blocking_reasons', NEW.blocking_reasons),
      jsonb_build_object('status', OLD.compliance_status),
      jsonb_build_object('status', NEW.compliance_status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_block_freight_compliance ON public.livestock_freight_compliance;
CREATE TRIGGER trigger_block_freight_compliance
  AFTER UPDATE OF compliance_status ON public.livestock_freight_compliance
  FOR EACH ROW EXECUTE FUNCTION public.block_freight_on_compliance_issue();