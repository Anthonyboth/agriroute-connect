-- Criar tabela para solicitações de serviços especiais
CREATE TABLE public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  provider_id UUID,
  service_type TEXT NOT NULL,
  location_address TEXT NOT NULL,
  location_lat NUMERIC,
  location_lng NUMERIC,
  problem_description TEXT NOT NULL,
  vehicle_info TEXT,
  urgency TEXT NOT NULL DEFAULT 'MEDIUM',
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  preferred_datetime TIMESTAMP WITH TIME ZONE,
  additional_info TEXT,
  is_emergency BOOLEAN DEFAULT false,
  estimated_price NUMERIC,
  final_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  provider_notes TEXT,
  client_rating INTEGER,
  provider_rating INTEGER,
  client_comment TEXT,
  provider_comment TEXT
);

-- Enable RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para service_requests
CREATE POLICY "Clients can create service requests" 
ON public.service_requests 
FOR INSERT 
WITH CHECK (client_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Clients can view their service requests" 
ON public.service_requests 
FOR SELECT 
USING (client_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Providers can view assigned requests" 
ON public.service_requests 
FOR SELECT 
USING (provider_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
) OR is_admin());

CREATE POLICY "Providers can update assigned requests" 
ON public.service_requests 
FOR UPDATE 
USING (provider_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
) OR is_admin());

CREATE POLICY "Clients can update their requests" 
ON public.service_requests 
FOR UPDATE 
USING (client_id IN (
  SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_service_requests_updated_at
BEFORE UPDATE ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();