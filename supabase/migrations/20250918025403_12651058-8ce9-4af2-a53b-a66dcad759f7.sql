-- Criar tabelas para o sistema de rastreamento e segurança

-- Adicionar campos de rastreamento à tabela freights
ALTER TABLE public.freights 
ADD COLUMN IF NOT EXISTS tracking_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS tracking_status text DEFAULT 'INACTIVE',
ADD COLUMN IF NOT EXISTS route_waypoints jsonb,
ADD COLUMN IF NOT EXISTS tracking_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS tracking_ended_at timestamp with time zone;

-- Tabela para armazenar localizações dos fretes
CREATE TABLE IF NOT EXISTS public.trip_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id uuid NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  speed numeric,
  heading numeric,
  accuracy numeric,
  source text DEFAULT 'GPS',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para logs de incidentes
CREATE TABLE IF NOT EXISTS public.incident_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id uuid NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  incident_type text NOT NULL, -- 'SIGNAL_LOST', 'ROUTE_DEVIATION', 'GPS_DISABLED', 'SUSPECTED_SPOOFING'
  severity text NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  status text NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'RESOLVED', 'REPORTED_TO_AUTHORITIES'
  operator_id uuid,
  last_known_lat numeric,
  last_known_lng numeric,
  description text,
  evidence_data jsonb,
  auto_generated boolean DEFAULT true,
  reported_to_authorities_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para arquivos de evidência
CREATE TABLE IF NOT EXISTS public.evidence_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES public.incident_logs(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para consentimentos de rastreamento
CREATE TABLE IF NOT EXISTS public.tracking_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  freight_id uuid NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  consent_given boolean NOT NULL DEFAULT false,
  consent_text text NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para configurações do sistema de rastreamento
CREATE TABLE IF NOT EXISTS public.tracking_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir configurações padrão
INSERT INTO public.tracking_settings (setting_key, setting_value, description) VALUES
('location_update_interval', '30', 'Intervalo de envio de localização em segundos'),
('signal_loss_threshold', '90', 'Tempo em segundos para considerar perda de sinal'),
('route_deviation_threshold', '5000', 'Distância em metros para considerar desvio significativo'),
('spoofing_detection_enabled', 'true', 'Ativar detecção de spoofing'),
('auto_report_to_authorities', 'false', 'Reportar automaticamente às autoridades sem revisão humana')
ON CONFLICT (setting_key) DO NOTHING;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.trip_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para trip_locations
CREATE POLICY "Users can insert their own locations" ON public.trip_locations
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND 
  freight_id IN (
    SELECT f.id FROM public.freights f
    JOIN public.profiles p ON f.driver_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view locations for their freights" ON public.trip_locations
FOR SELECT USING (
  freight_id IN (
    SELECT f.id FROM public.freights f
    JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid()
  ) OR is_admin()
);

-- Políticas RLS para incident_logs
CREATE POLICY "Users can view incidents for their freights" ON public.incident_logs
FOR SELECT USING (
  freight_id IN (
    SELECT f.id FROM public.freights f
    JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid()
  ) OR is_admin()
);

CREATE POLICY "System can create incidents" ON public.incident_logs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update incidents" ON public.incident_logs
FOR UPDATE USING (is_admin());

-- Políticas RLS para evidence_files
CREATE POLICY "Users can view evidence for their incidents" ON public.evidence_files
FOR SELECT USING (
  incident_id IN (
    SELECT il.id FROM public.incident_logs il
    JOIN public.freights f ON il.freight_id = f.id
    JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid()
  ) OR is_admin()
);

-- Políticas RLS para tracking_consents
CREATE POLICY "Users can manage their own consents" ON public.tracking_consents
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Políticas RLS para tracking_settings
CREATE POLICY "Anyone can view tracking settings" ON public.tracking_settings
FOR SELECT USING (true);

CREATE POLICY "Admins can manage tracking settings" ON public.tracking_settings
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_trip_locations_freight_id ON public.trip_locations(freight_id);
CREATE INDEX IF NOT EXISTS idx_trip_locations_created_at ON public.trip_locations(created_at);
CREATE INDEX IF NOT EXISTS idx_incident_logs_freight_id ON public.incident_logs(freight_id);
CREATE INDEX IF NOT EXISTS idx_incident_logs_status ON public.incident_logs(status);
CREATE INDEX IF NOT EXISTS idx_evidence_files_incident_id ON public.evidence_files(incident_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_tracking_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_incident_logs_updated_at
  BEFORE UPDATE ON public.incident_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tracking_updated_at_column();

CREATE TRIGGER update_tracking_settings_updated_at
  BEFORE UPDATE ON public.tracking_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tracking_updated_at_column();