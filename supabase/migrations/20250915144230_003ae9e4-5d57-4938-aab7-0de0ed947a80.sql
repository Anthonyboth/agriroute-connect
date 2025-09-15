-- Criar tabela para prestadores de serviços urbanos
CREATE TABLE public.urban_service_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  service_types TEXT[] NOT NULL DEFAULT ARRAY['MUDANCA', 'FRETE_URBANO', 'COLETA_ENTREGA'],
  service_radius_km INTEGER DEFAULT 30,
  base_price NUMERIC DEFAULT 0,
  price_per_km NUMERIC DEFAULT 5.0,
  price_per_kg NUMERIC DEFAULT 2.0,
  vehicle_types TEXT[] DEFAULT ARRAY['VAN', 'CAMINHAO_PEQUENO', 'CARRO'],
  work_hours_start TIME DEFAULT '08:00',
  work_hours_end TIME DEFAULT '18:00',
  works_weekends BOOLEAN DEFAULT false,
  works_holidays BOOLEAN DEFAULT false,
  emergency_service BOOLEAN DEFAULT false,
  company_name TEXT,
  cnpj TEXT,
  equipment_description TEXT,
  specialties TEXT[],
  service_area_cities TEXT[],
  insurance_coverage NUMERIC DEFAULT 10000,
  license_number TEXT,
  vehicle_capacity_kg NUMERIC DEFAULT 1000,
  vehicle_capacity_m3 NUMERIC DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.urban_service_providers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Providers can insert their own services"
ON public.urban_service_providers
FOR INSERT
WITH CHECK (profile_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Providers can update their own services"
ON public.urban_service_providers
FOR UPDATE
USING (profile_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can view service providers"
ON public.urban_service_providers
FOR SELECT
USING (true);

-- Trigger para atualizar timestamp
CREATE TRIGGER update_urban_service_providers_updated_at
  BEFORE UPDATE ON public.urban_service_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela para solicitações de serviços urbanos
CREATE TABLE public.urban_service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  provider_id UUID,
  service_type TEXT NOT NULL,
  origin_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  origin_lat NUMERIC,
  origin_lng NUMERIC,
  destination_lat NUMERIC,
  destination_lng NUMERIC,
  distance_km NUMERIC,
  pickup_date DATE NOT NULL,
  delivery_date DATE,
  estimated_weight NUMERIC,
  estimated_volume NUMERIC,
  package_dimensions TEXT,
  special_items TEXT,
  additional_services TEXT[],
  contact_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  price NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.urban_service_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Clients can create requests"
ON public.urban_service_requests
FOR INSERT
WITH CHECK (client_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Clients can view their own requests"
ON public.urban_service_requests
FOR SELECT
USING (client_id IN (
  SELECT id FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Providers can view requests in their area"
ON public.urban_service_requests
FOR SELECT
USING (
  status = 'PENDING' OR 
  provider_id IN (
    SELECT id FROM public.urban_service_providers 
    WHERE profile_id IN (
      SELECT id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Providers can update accepted requests"
ON public.urban_service_requests
FOR UPDATE
USING (provider_id IN (
  SELECT id FROM public.urban_service_providers 
  WHERE profile_id IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid()
  )
));

-- Trigger para atualizar timestamp
CREATE TRIGGER update_urban_service_requests_updated_at
  BEFORE UPDATE ON public.urban_service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();