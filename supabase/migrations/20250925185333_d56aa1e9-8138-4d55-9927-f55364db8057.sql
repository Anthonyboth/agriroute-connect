-- Critical Security Fixes: Drop and Recreate RLS Policies

-- Drop ALL existing policies on these tables first
DROP POLICY IF EXISTS "Users can view ratings for their services" ON public.ratings;
DROP POLICY IF EXISTS "Users can create ratings for completed freights" ON public.ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can view ratings for their freights" ON public.ratings;
DROP POLICY IF EXISTS "Users can create ratings" ON public.ratings;
DROP POLICY IF EXISTS "Authenticated users can view guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Authenticated users can create guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Service providers can update relevant requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Authenticated users can view service areas" ON public.service_provider_areas;
DROP POLICY IF EXISTS "Service providers can manage their areas" ON public.service_provider_areas;
DROP POLICY IF EXISTS "Authenticated users can view available freights" ON public.freights;

-- Enable RLS on tables that need it
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_provider_areas ENABLE ROW LEVEL SECURITY;

-- RATINGS: Only authenticated users with proper relationships
CREATE POLICY "ratings_select_authenticated" ON public.ratings
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      rated_user_id = auth.uid() OR
      rater_user_id = auth.uid() OR
      freight_id IN (
        SELECT f.id FROM freights f 
        JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
        WHERE p.user_id = auth.uid()
      ) OR
      is_admin()
    )
  );

CREATE POLICY "ratings_insert_authenticated" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND rater_user_id = auth.uid()
  );

CREATE POLICY "ratings_update_own" ON public.ratings
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND rater_user_id = auth.uid()
  );

-- GUEST_REQUESTS: Only authenticated users
CREATE POLICY "guest_requests_select_auth" ON public.guest_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "guest_requests_insert_auth" ON public.guest_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "guest_requests_update_providers" ON public.guest_requests
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      provider_id IN (
        SELECT sp.id FROM service_providers sp
        JOIN profiles p ON sp.profile_id = p.id
        WHERE p.user_id = auth.uid()
      ) OR is_admin()
    )
  );

-- SERVICE_PROVIDER_AREAS: Only authenticated users can view, providers manage own
CREATE POLICY "service_areas_select_auth" ON public.service_provider_areas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "service_areas_manage_own" ON public.service_provider_areas
  FOR ALL USING (
    provider_id IN (
      SELECT sp.id FROM service_providers sp
      JOIN profiles p ON sp.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT sp.id FROM service_providers sp
      JOIN profiles p ON sp.profile_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- FREIGHTS: Authenticated users can view open freights or their own
CREATE POLICY "freights_select_authenticated" ON public.freights
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      status = 'OPEN' OR
      producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
      driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
      is_admin()
    )
  );