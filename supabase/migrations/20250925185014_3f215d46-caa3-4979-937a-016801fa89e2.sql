-- Critical Security Fixes: RLS Policies for Public Data Exposure (Corrected)

-- Enable RLS on tables that are currently publicly accessible
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_provider_areas ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic policies if they exist
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
DROP POLICY IF EXISTS "Anyone can view guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Anyone can view service provider areas" ON public.service_provider_areas;
DROP POLICY IF EXISTS "Anyone can view available freights" ON public.freights;

-- RATINGS table: Restrict to authenticated users and proper access control
-- Using correct column names: rated_user_id, rater_user_id, freight_id
CREATE POLICY "Users can view ratings for their services" ON public.ratings
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      -- Users can see ratings they received
      rated_user_id = auth.uid()
      OR
      -- Users can see ratings they gave
      rater_user_id = auth.uid()
      OR
      -- Users can see ratings for freights they're involved in
      freight_id IN (
        SELECT f.id FROM freights f 
        JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
        WHERE p.user_id = auth.uid()
      )
      OR
      -- Admins can see all ratings
      is_admin()
    )
  );

CREATE POLICY "Users can create ratings" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    rater_user_id = auth.uid() AND
    freight_id IN (
      SELECT f.id FROM freights f 
      JOIN profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
      WHERE p.user_id = auth.uid() AND f.status = 'DELIVERED'
    )
  );

CREATE POLICY "Users can update their own ratings" ON public.ratings
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND rater_user_id = auth.uid()
  );

-- GUEST_REQUESTS table: Restrict to authenticated users only
CREATE POLICY "Authenticated users can view guest requests" ON public.guest_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create guest requests" ON public.guest_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service providers can update relevant requests" ON public.guest_requests
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      provider_id IN (
        SELECT sp.id FROM service_providers sp
        JOIN profiles p ON sp.profile_id = p.id
        WHERE p.user_id = auth.uid()
      )
      OR is_admin()
    )
  );

-- SERVICE_PROVIDER_AREAS table: Restrict to authenticated users
CREATE POLICY "Authenticated users can view service areas" ON public.service_provider_areas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service providers can manage their areas" ON public.service_provider_areas
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

-- FREIGHTS table: Ensure proper access control (replace the overly permissive policy)
CREATE POLICY "Authenticated users can view available freights" ON public.freights
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      -- Open freights are viewable by authenticated users
      status = 'OPEN'
      OR
      -- Users can see their own freights
      producer_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      OR
      driver_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      OR
      -- Admins can see all
      is_admin()
    )
  );