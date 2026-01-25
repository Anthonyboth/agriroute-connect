-- ============================================
-- P0 SECURITY FIX: user_cities exposure
-- Remove public access policy, require authentication
-- ============================================

-- 1. Drop the problematic public access policy
DROP POLICY IF EXISTS "Anyone can view active cities" ON public.user_cities;

-- 2. Create a more restrictive policy for authenticated users
-- Authenticated users can only view their own cities
CREATE POLICY "Authenticated users view own cities"
ON public.user_cities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Create policy for providers to see cities of other providers for matching
-- (Only if they are part of the same transport company or similar business need)
-- For now, we keep it simple: users can only see their own cities
-- This is the most secure approach for the current phase

COMMENT ON POLICY "Authenticated users view own cities" ON public.user_cities IS 
'Security fix: Replaced public access policy. Users can only view their own service areas.';