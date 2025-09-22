-- Create enum for vehicle/service categories
CREATE TYPE public.service_category AS ENUM (
  'rodotrem',
  'carreta', 
  'truck',
  'vuc',
  'pickup',
  'prestador'
);

-- Create enum for plan types
CREATE TYPE public.plan_type AS ENUM (
  'free',
  'essential', 
  'professional'
);

-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'canceled',
  'past_due',
  'unpaid',
  'incomplete'
);

-- Create plans table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category service_category NOT NULL,
  plan_type plan_type NOT NULL,
  name TEXT NOT NULL,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  percentage_fee NUMERIC(5,2) NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(category, plan_type)
);

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID REFERENCES public.plans(id) ON DELETE RESTRICT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create subscription fees table for tracking percentage fees on freights
CREATE TABLE public.subscription_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  
  freight_id UUID REFERENCES public.freights(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  fee_amount NUMERIC(10,2) NOT NULL,
  fee_percentage NUMERIC(5,2) NOT NULL,
  freight_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for plans
CREATE POLICY "Users can view plans for their category" ON public.plans
  FOR SELECT USING (
    category IN (
      SELECT UNNEST(
        CASE 
          WHEN EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA') 
          THEN ARRAY(
            SELECT DISTINCT 
              CASE 
                WHEN v.vehicle_type = 'RODOTREM' THEN 'rodotrem'::service_category
                WHEN v.vehicle_type = 'CARRETA' THEN 'carreta'::service_category
                WHEN v.vehicle_type = 'CARRETA_BAU' THEN 'carreta'::service_category
                WHEN v.vehicle_type = 'TRUCK' THEN 'truck'::service_category
                WHEN v.vehicle_type = 'TOCO' THEN 'truck'::service_category
                WHEN v.vehicle_type = 'BITREM' THEN 'truck'::service_category
                WHEN v.vehicle_type = 'VUC' THEN 'vuc'::service_category
                WHEN v.vehicle_type = 'F400' THEN 'pickup'::service_category
                WHEN v.vehicle_type = 'STRADA' THEN 'pickup'::service_category
                WHEN v.vehicle_type = 'CARRO_PEQUENO' THEN 'pickup'::service_category
                ELSE 'truck'::service_category
              END
            FROM vehicles v 
            JOIN profiles p ON v.driver_id = p.id 
            WHERE p.user_id = auth.uid()
          )
          WHEN EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'PRESTADOR_SERVICOS')
          THEN ARRAY['prestador'::service_category]
          ELSE ARRAY['truck'::service_category]
        END
      )
    )
    OR is_admin()
  );

-- Create RLS policies for user_subscriptions  
CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Users can create their own subscriptions" ON public.user_subscriptions
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own subscriptions" ON public.user_subscriptions
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Create RLS policies for subscription_fees
CREATE POLICY "Users can view their own subscription fees" ON public.subscription_fees
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "System can insert subscription fees" ON public.subscription_fees
  FOR INSERT WITH CHECK (true);

-- Create triggers for updated_at
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert all plans according to the requirements
INSERT INTO public.plans (category, plan_type, name, monthly_fee, percentage_fee, features) VALUES
-- Rodotrem / 9 eixos
('rodotrem', 'free', 'Plano Grátis - Rodotrem', 0, 5.00, '["Acesso básico à plataforma", "5% de taxa sobre fretes"]'),
('rodotrem', 'essential', 'Plano Essencial - Rodotrem', 149.00, 2.00, '["Suporte prioritário", "R$ 149/mês + 2% sobre fretes", "Dashboard avançado"]'),
('rodotrem', 'professional', 'Plano Profissional - Rodotrem', 299.00, 0, '["Sem taxa sobre fretes", "R$ 299/mês fixo", "Suporte premium", "Relatórios completos"]'),

-- Carreta / Carreta Baú
('carreta', 'free', 'Plano Grátis - Carreta', 0, 5.00, '["Acesso básico à plataforma", "5% de taxa sobre fretes"]'),
('carreta', 'essential', 'Plano Essencial - Carreta', 159.00, 2.00, '["Suporte prioritário", "R$ 159/mês + 2% sobre fretes", "Dashboard avançado"]'),
('carreta', 'professional', 'Plano Profissional - Carreta', 249.00, 0, '["Sem taxa sobre fretes", "R$ 249/mês fixo", "Suporte premium", "Relatórios completos"]'),

-- Truck / Toco / Bitrem
('truck', 'free', 'Plano Grátis - Truck/Toco', 0, 5.00, '["Acesso básico à plataforma", "5% de taxa sobre fretes"]'),
('truck', 'essential', 'Plano Essencial - Truck/Toco', 159.00, 2.00, '["Suporte prioritário", "R$ 159/mês + 2% sobre fretes", "Dashboard avançado"]'),
('truck', 'professional', 'Plano Profissional - Truck/Toco', 249.00, 0, '["Sem taxa sobre fretes", "R$ 249/mês fixo", "Suporte premium", "Relatórios completos"]'),

-- VUC / 3/4 urbano
('vuc', 'free', 'Plano Grátis - VUC', 0, 5.00, '["Acesso básico à plataforma", "5% de taxa sobre fretes"]'),
('vuc', 'essential', 'Plano Essencial - VUC', 129.00, 2.00, '["Suporte prioritário", "R$ 129/mês + 2% sobre fretes", "Dashboard avançado"]'),
('vuc', 'professional', 'Plano Profissional - VUC', 249.00, 0, '["Sem taxa sobre fretes", "R$ 249/mês fixo", "Suporte premium", "Relatórios completos"]'),

-- Pickups urbanas (F400, Strada, Carro Pequeno)
('pickup', 'free', 'Plano Grátis - Pickup', 0, 5.00, '["Acesso básico à plataforma", "5% de taxa sobre fretes"]'),
('pickup', 'essential', 'Plano Essencial - Pickup', 119.00, 2.00, '["Suporte prioritário", "R$ 119/mês + 2% sobre fretes", "Dashboard avançado"]'),
('pickup', 'professional', 'Plano Profissional - Pickup', 199.00, 0, '["Sem taxa sobre fretes", "R$ 199/mês fixo", "Suporte premium", "Relatórios completos"]'),

-- Prestadores de serviços
('prestador', 'free', 'Plano Grátis - Prestador', 0, 5.00, '["Acesso básico à plataforma", "5% de taxa sobre serviços"]'),
('prestador', 'essential', 'Plano Essencial - Prestador', 59.00, 2.00, '["Suporte prioritário", "R$ 59/mês + 2% sobre serviços", "Dashboard avançado"]'),
('prestador', 'professional', 'Plano Profissional - Prestador', 99.00, 0, '["Sem taxa sobre serviços", "R$ 99/mês fixo", "Suporte premium", "Relatórios completos"]');