-- ========================================
-- FASE 1: Tabela report_exports para registrar exportações
-- ========================================
CREATE TABLE IF NOT EXISTS public.report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('producer', 'driver', 'provider', 'company', 'admin')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  date_range_from TIMESTAMPTZ,
  date_range_to TIMESTAMPTZ,
  file_url TEXT,
  file_size_bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own exports
CREATE POLICY "Users can view their own exports"
ON public.report_exports FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own exports
CREATE POLICY "Users can create their own exports"
ON public.report_exports FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_report_exports_user_id ON public.report_exports(user_id);
CREATE INDEX idx_report_exports_profile_id ON public.report_exports(profile_id);
CREATE INDEX idx_report_exports_created_at ON public.report_exports(created_at DESC);

-- ========================================
-- FASE 4: Tabelas de Gamificação para Motoristas
-- ========================================

-- Tipos de badges disponíveis
CREATE TABLE IF NOT EXISTS public.badge_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('milestone', 'performance', 'special', 'seasonal')),
  xp_reward INTEGER NOT NULL DEFAULT 0,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Badges conquistados pelos motoristas
CREATE TABLE IF NOT EXISTS public.driver_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_type_id TEXT NOT NULL REFERENCES public.badge_types(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(driver_id, badge_type_id)
);

-- Níveis e XP dos motoristas
CREATE TABLE IF NOT EXISTS public.driver_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  current_xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recompensas disponíveis
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount', 'priority', 'badge', 'cash')),
  value NUMERIC,
  required_level INTEGER DEFAULT 1,
  required_xp INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recompensas resgatadas
CREATE TABLE IF NOT EXISTS public.driver_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'expired')),
  expires_at TIMESTAMPTZ
);

-- Enable RLS for gamification tables
ALTER TABLE public.badge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rewards ENABLE ROW LEVEL SECURITY;

-- Badge types são públicos para leitura
CREATE POLICY "Anyone can view badge types" ON public.badge_types FOR SELECT USING (true);

-- Driver badges - motorista vê suas próprias e todos podem ver para rankings
CREATE POLICY "Users can view driver badges" ON public.driver_badges FOR SELECT USING (true);
CREATE POLICY "System inserts driver badges" ON public.driver_badges FOR INSERT WITH CHECK (true);

-- Driver levels - motorista vê suas próprias e todos podem ver para rankings
CREATE POLICY "Users can view driver levels" ON public.driver_levels FOR SELECT USING (true);
CREATE POLICY "System manages driver levels" ON public.driver_levels FOR ALL USING (true);

-- Rewards são públicos para leitura
CREATE POLICY "Anyone can view rewards" ON public.rewards FOR SELECT USING (true);

-- Driver rewards - motorista vê suas próprias
CREATE POLICY "Users can view their rewards" ON public.driver_rewards FOR SELECT 
USING (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can redeem rewards" ON public.driver_rewards FOR INSERT 
WITH CHECK (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Inserir badges iniciais
INSERT INTO public.badge_types (id, name, description, icon, category, xp_reward, requirement_type, requirement_value) VALUES
('first_delivery', 'Primeira Entrega', 'Completou sua primeira entrega', '🎖️', 'milestone', 50, 'deliveries', 1),
('delivery_10', '10 Entregas', 'Completou 10 entregas', '🏅', 'milestone', 100, 'deliveries', 10),
('delivery_50', '50 Entregas', 'Completou 50 entregas', '🥈', 'milestone', 250, 'deliveries', 50),
('delivery_100', 'Centurião', 'Completou 100 entregas', '🥇', 'milestone', 500, 'deliveries', 100),
('delivery_500', 'Mestre das Estradas', 'Completou 500 entregas', '🏆', 'milestone', 1000, 'deliveries', 500),
('five_stars', '5 Estrelas', 'Recebeu 10 avaliações 5 estrelas', '⭐', 'performance', 150, 'five_star_ratings', 10),
('safe_driver', 'Motorista Seguro', 'Sem incidentes em 50 entregas', '🛡️', 'performance', 200, 'safe_deliveries', 50),
('fast_responder', 'Resposta Rápida', 'Aceitou 20 fretes em menos de 5 minutos', '⚡', 'performance', 100, 'fast_accepts', 20),
('early_bird', 'Madrugador', 'Completou 10 entregas antes das 8h', '🌅', 'special', 75, 'early_deliveries', 10),
('night_owl', 'Coruja Noturna', 'Completou 10 entregas após 22h', '🦉', 'special', 75, 'night_deliveries', 10),
('km_1000', 'Mil Quilômetros', 'Percorreu 1.000 km em entregas', '🚚', 'milestone', 150, 'total_km', 1000),
('km_10000', 'Dez Mil Quilômetros', 'Percorreu 10.000 km em entregas', '🛣️', 'milestone', 500, 'total_km', 10000),
('loyal_driver', 'Motorista Fiel', 'Ativo por 6 meses consecutivos', '💎', 'special', 300, 'months_active', 6)
ON CONFLICT (id) DO NOTHING;

-- Criar índices para gamificação
CREATE INDEX IF NOT EXISTS idx_driver_badges_driver_id ON public.driver_badges(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_levels_driver_id ON public.driver_levels(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_levels_level ON public.driver_levels(level DESC);
CREATE INDEX IF NOT EXISTS idx_driver_rewards_driver_id ON public.driver_rewards(driver_id);

-- ========================================
-- FASE 8: Tabela para tracking de feature flags premium
-- ========================================
CREATE TABLE IF NOT EXISTS public.premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'premium', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  features JSONB DEFAULT '{"unlimited_exports": false, "full_history": false, "period_comparison": false, "auto_insights": false}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON public.premium_subscriptions 
FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_user_id ON public.premium_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_subscriptions_profile_id ON public.premium_subscriptions(profile_id);