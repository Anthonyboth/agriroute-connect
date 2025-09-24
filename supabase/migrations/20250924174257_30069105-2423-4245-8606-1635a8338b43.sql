-- Enable RLS on tables that currently don't have it enabled
-- This addresses the critical security vulnerability: RLS Disabled in Public
-- Excluding system tables we don't own

-- Enable RLS on ratings table (contains user ratings and reviews)
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view ratings where they are involved" ON public.ratings;
CREATE POLICY "Users can view ratings where they are involved"
ON public.ratings FOR SELECT
USING (
  rated_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "Users can create ratings for completed freights" ON public.ratings;
CREATE POLICY "Users can create ratings for completed freights"
ON public.ratings FOR INSERT
WITH CHECK (
  rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND freight_id IN (
    SELECT f.id FROM freights f 
    JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid() AND f.status = 'DELIVERED'
  )
);

-- Enable RLS on service_providers table (contains business data)
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

-- Service providers policies
DROP POLICY IF EXISTS "Service providers can view their own data" ON public.service_providers;
CREATE POLICY "Service providers can view their own data"
ON public.service_providers FOR SELECT
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "Users can create their service provider profile" ON public.service_providers;
CREATE POLICY "Users can create their service provider profile"
ON public.service_providers FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'PRESTADOR_SERVICOS')
);

DROP POLICY IF EXISTS "Service providers can update their own data" ON public.service_providers;
CREATE POLICY "Service providers can update their own data"
ON public.service_providers FOR UPDATE
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Enable RLS on plans table (contains pricing strategy)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Plans policies
DROP POLICY IF EXISTS "Authenticated users can view plans" ON public.plans;
CREATE POLICY "Authenticated users can view plans"
ON public.plans FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only admins can manage plans" ON public.plans;
CREATE POLICY "Only admins can manage plans"
ON public.plans FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Enable RLS on guest_requests table
ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;

-- Guest requests policies
DROP POLICY IF EXISTS "Only admins can view guest requests" ON public.guest_requests;
CREATE POLICY "Only admins can view guest requests"
ON public.guest_requests FOR SELECT
USING (is_admin());

DROP POLICY IF EXISTS "System can manage guest requests" ON public.guest_requests;
CREATE POLICY "System can manage guest requests"
ON public.guest_requests FOR ALL
USING (true)
WITH CHECK (true);

-- Check and handle other tables that might need RLS enabled
DO $$ 
BEGIN
  -- Enable RLS on service_requests table if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t 
    JOIN pg_class c ON c.relname = t.tablename 
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'service_requests' 
    AND c.relrowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY';
  END IF;

  -- Enable RLS on notifications table if not already enabled  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables t 
    JOIN pg_class c ON c.relname = t.tablename 
    WHERE t.schemaname = 'public' 
    AND t.tablename = 'notifications' 
    AND c.relrowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
  END IF;

  -- Enable RLS on promotions table if it exists and doesn't have RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables t 
      JOIN pg_class c ON c.relname = t.tablename 
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'promotions' 
      AND c.relrowsecurity = true
    ) THEN
      EXECUTE 'ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY';
      EXECUTE 'CREATE POLICY "Authenticated users can view active promotions" ON public.promotions FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true)';
      EXECUTE 'CREATE POLICY "Only admins can manage promotions" ON public.promotions FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
    END IF;
  END IF;

  -- Enable RLS on subscriptions table if it exists and doesn't have RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables t 
      JOIN pg_class c ON c.relname = t.tablename 
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'subscriptions' 
      AND c.relrowsecurity = true
    ) THEN
      EXECUTE 'ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY';
      EXECUTE 'CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))';
      EXECUTE 'CREATE POLICY "Users can create their own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))';
      EXECUTE 'CREATE POLICY "Users can update their own subscriptions" ON public.subscriptions FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))';
    END IF;
  END IF;

  -- Enable RLS on user_preferences table if it exists and doesn't have RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables t 
      JOIN pg_class c ON c.relname = t.tablename 
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'user_preferences' 
      AND c.relrowsecurity = true
    ) THEN
      EXECUTE 'ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY';
      EXECUTE 'CREATE POLICY "Users can manage their own preferences" ON public.user_preferences FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))';
    END IF;
  END IF;

  -- Enable RLS on tracking_settings table if it exists and doesn't have RLS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tracking_settings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables t 
      JOIN pg_class c ON c.relname = t.tablename 
      WHERE t.schemaname = 'public' 
      AND t.tablename = 'tracking_settings' 
      AND c.relrowsecurity = true
    ) THEN
      EXECUTE 'ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY';
      EXECUTE 'CREATE POLICY "Users can view their tracking settings" ON public.tracking_settings FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR is_admin())';
      EXECUTE 'CREATE POLICY "Users can manage their tracking settings" ON public.tracking_settings FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))';
    END IF;
  END IF;
END $$;

-- Add comments to document the security fix
COMMENT ON TABLE public.ratings IS 'RLS enabled - contains sensitive user rating data';
COMMENT ON TABLE public.service_providers IS 'RLS enabled - contains business-sensitive provider data';
COMMENT ON TABLE public.plans IS 'RLS enabled - contains pricing strategy information';
COMMENT ON TABLE public.guest_requests IS 'RLS enabled - guest requests restricted to admins';