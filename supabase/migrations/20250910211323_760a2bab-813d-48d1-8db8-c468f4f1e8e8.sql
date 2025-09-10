-- Adicionar campos de segurança que estão faltando na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN cnh_expiry_date DATE,
ADD COLUMN cnh_category TEXT,
ADD COLUMN document_validation_status TEXT DEFAULT 'PENDING' CHECK (document_validation_status IN ('PENDING', 'VALIDATED', 'REJECTED')),
ADD COLUMN cnh_validation_status TEXT DEFAULT 'PENDING' CHECK (cnh_validation_status IN ('PENDING', 'VALIDATED', 'EXPIRED', 'REJECTED')),
ADD COLUMN rntrc_validation_status TEXT DEFAULT 'PENDING' CHECK (rntrc_validation_status IN ('PENDING', 'VALIDATED', 'REJECTED')),
ADD COLUMN validation_notes TEXT,
ADD COLUMN emergency_contact_name TEXT,
ADD COLUMN emergency_contact_phone TEXT,
ADD COLUMN background_check_status TEXT DEFAULT 'PENDING' CHECK (background_check_status IN ('PENDING', 'APPROVED', 'REJECTED')),
ADD COLUMN rating_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN last_gps_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN current_location_lat NUMERIC,
ADD COLUMN current_location_lng NUMERIC;

-- Adicionar campos de segurança que estão faltando na tabela vehicles  
ALTER TABLE public.vehicles
ADD COLUMN crlv_expiry_date DATE,
ADD COLUMN insurance_expiry_date DATE,
ADD COLUMN last_inspection_date DATE,
ADD COLUMN inspection_certificate_url TEXT,
ADD COLUMN insurance_document_url TEXT,
ADD COLUMN vehicle_validation_status TEXT DEFAULT 'PENDING' CHECK (vehicle_validation_status IN ('PENDING', 'VALIDATED', 'REJECTED'));

-- Criar tabela para histórico de validações
CREATE TABLE public.validation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  validation_type TEXT NOT NULL CHECK (validation_type IN ('DOCUMENT', 'CNH', 'RNTRC', 'VEHICLE', 'BACKGROUND_CHECK')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  validated_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para validation_history
ALTER TABLE public.validation_history ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para validation_history
CREATE POLICY "Users can view their own validation history"
ON public.validation_history
FOR SELECT
USING (profile_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
) OR is_admin());

CREATE POLICY "Admins can create validation records"
ON public.validation_history
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update validation records"
ON public.validation_history
FOR UPDATE
USING (is_admin());

-- Criar tabela para eventos de emergência/SOS
CREATE TABLE public.emergency_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  freight_id UUID REFERENCES public.freights(id),
  event_type TEXT NOT NULL DEFAULT 'SOS' CHECK (event_type IN ('SOS', 'EMERGENCY', 'BREAKDOWN', 'ACCIDENT')),
  location_lat NUMERIC,
  location_lng NUMERIC,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'CANCELLED')),
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS para emergency_events
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para emergency_events
CREATE POLICY "Users can create their own emergency events"
ON public.emergency_events
FOR INSERT
WITH CHECK (user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can view their own emergency events or admins can view all"
ON public.emergency_events
FOR SELECT
USING (user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
) OR is_admin());

CREATE POLICY "Admins can update emergency events"
ON public.emergency_events
FOR UPDATE
USING (is_admin());

-- Criar função para verificar documentos vencidos
CREATE OR REPLACE FUNCTION public.check_expired_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar CNHs vencidas
  UPDATE public.profiles 
  SET cnh_validation_status = 'EXPIRED',
      status = 'REJECTED'
  WHERE cnh_expiry_date < CURRENT_DATE 
    AND cnh_validation_status = 'VALIDATED'
    AND role = 'MOTORISTA';
    
  -- Atualizar CRLVs vencidos
  UPDATE public.vehicles v
  SET vehicle_validation_status = 'REJECTED'
  FROM public.profiles p
  WHERE v.driver_id = p.id
    AND v.crlv_expiry_date < CURRENT_DATE 
    AND v.vehicle_validation_status = 'VALIDATED';
    
  -- Atualizar seguros vencidos  
  UPDATE public.vehicles v
  SET status = 'REJECTED'
  FROM public.profiles p
  WHERE v.driver_id = p.id
    AND v.insurance_expiry_date < CURRENT_DATE
    AND v.status = 'APPROVED';
END;
$$;

-- Criar função para verificar e bloquear usuários com rating baixo
CREATE OR REPLACE FUNCTION public.check_low_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bloquear motoristas com rating menor que 3.0 e mais de 5 avaliações
  UPDATE public.profiles 
  SET rating_locked = TRUE,
      status = 'REJECTED'
  WHERE role = 'MOTORISTA'
    AND rating < 3.0 
    AND total_ratings > 5
    AND rating_locked = FALSE;
END;
$$;

-- Criar trigger para atualizar updated_at em validation_history
CREATE TRIGGER update_validation_history_updated_at
BEFORE UPDATE ON public.validation_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_profiles_cnh_expiry ON public.profiles(cnh_expiry_date) WHERE role = 'MOTORISTA';
CREATE INDEX idx_profiles_validation_status ON public.profiles(document_validation_status, cnh_validation_status, rntrc_validation_status);
CREATE INDEX idx_vehicles_expiry_dates ON public.vehicles(crlv_expiry_date, insurance_expiry_date);
CREATE INDEX idx_emergency_events_user ON public.emergency_events(user_id, status);
CREATE INDEX idx_validation_history_profile ON public.validation_history(profile_id, validation_type);