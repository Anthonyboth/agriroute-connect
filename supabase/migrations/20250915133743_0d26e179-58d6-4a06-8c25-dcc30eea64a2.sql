-- Adicionar campos faltantes na tabela profiles para foto de perfil e outros campos necessários
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_other_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vehicle_specifications text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS live_cargo_experience boolean DEFAULT false;

-- Adicionar campos para valor por KM e taxas extras nos fretes
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS price_per_km numeric;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS extra_fees numeric;
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS extra_fees_description text;

-- Adicionar tabela para prestadores de serviços
CREATE TABLE IF NOT EXISTS public.service_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_type text NOT NULL, -- 'MECANICO', 'BORRACHEIRO', 'ELETRICISTA', 'GUINCHO', etc.
  specialties text[], -- Especialidades específicas
  service_radius_km integer DEFAULT 50, -- Raio de atendimento em km
  base_price numeric, -- Preço base do serviço
  hourly_rate numeric, -- Valor por hora
  emergency_service boolean DEFAULT true, -- Atende emergências
  work_hours_start time, -- Horário de início
  work_hours_end time, -- Horário de fim
  works_weekends boolean DEFAULT false,
  works_holidays boolean DEFAULT false,
  equipment_description text, -- Descrição dos equipamentos disponíveis
  certifications text[], -- Certificações profissionais
  service_area_cities text[], -- Cidades de atuação
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela service_providers
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para service_providers
CREATE POLICY "Users can view service providers"
ON public.service_providers
FOR SELECT
USING (true);

CREATE POLICY "Providers can insert their own services"
ON public.service_providers
FOR INSERT
WITH CHECK (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Providers can update their own services"
ON public.service_providers
FOR UPDATE
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Adicionar tabela de planos de cobrança
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_category text NOT NULL, -- 'RODOTREM_9_EIXOS', 'CARRETA_7_EIXOS', etc.
  plan_type text NOT NULL, -- 'FREE', 'ESSENTIAL', 'PROFESSIONAL'
  free_freight_percentage numeric, -- % para plano grátis
  monthly_fee numeric, -- Taxa mensal fixa
  freight_percentage numeric, -- % sobre frete no plano pago
  free_freights_count integer DEFAULT 3, -- Quantidade de fretes grátis
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela pricing_plans
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

-- Política para visualizar planos
CREATE POLICY "Anyone can view pricing plans"
ON public.pricing_plans
FOR SELECT
USING (true);

-- Inserir dados dos planos de cobrança
INSERT INTO public.pricing_plans (vehicle_category, plan_type, free_freight_percentage, monthly_fee, freight_percentage) VALUES
('RODOTREM_9_EIXOS', 'FREE', 1.8, 0, 1.8),
('RODOTREM_9_EIXOS', 'ESSENTIAL', 1.0, 189, 1.0),
('RODOTREM_9_EIXOS', 'PROFESSIONAL', 0, 369, 0),
('CARRETA_7_EIXOS', 'FREE', 1.6, 0, 1.6),
('CARRETA_7_EIXOS', 'ESSENTIAL', 0.9, 159, 0.9),
('CARRETA_7_EIXOS', 'PROFESSIONAL', 0, 349, 0),
('TRUCK_TOCO', 'FREE', 1.5, 0, 1.5),
('TRUCK_TOCO', 'ESSENTIAL', 0.8, 129, 0.8),
('TRUCK_TOCO', 'PROFESSIONAL', 0, 299, 0),
('VUC_URBANO', 'FREE', 1.3, 0, 1.3),
('VUC_URBANO', 'ESSENTIAL', 0.7, 119, 0.7),
('VUC_URBANO', 'PROFESSIONAL', 0, 219, 0),
('PICKUP_URBANA', 'FREE', 1.2, 0, 1.2),
('PICKUP_URBANA', 'ESSENTIAL', 0.6, 69, 0.6),
('PICKUP_URBANA', 'PROFESSIONAL', 0, 149, 0),
('CAMINHAO_PRANCHA', 'FREE', 1.4, 0, 1.4),
('CAMINHAO_PRANCHA', 'ESSENTIAL', 0.7, 129, 0.7),
('CAMINHAO_PRANCHA', 'PROFESSIONAL', 0, 329, 0),
('PRESTADOR_SERVICOS', 'FREE', 1.2, 0, 1.2),
('PRESTADOR_SERVICOS', 'ESSENTIAL', 0.6, 49, 0.6),
('PRESTADOR_SERVICOS', 'PROFESSIONAL', 0, 99, 0);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_service_providers_updated_at
  BEFORE UPDATE ON public.service_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_pricing_plans_updated_at
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();