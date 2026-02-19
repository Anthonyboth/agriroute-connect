
-- Fix 1: badge_types - restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view badge types" ON public.badge_types;
CREATE POLICY "Authenticated users can view badge types"
ON public.badge_types FOR SELECT TO authenticated
USING (true);

-- Fix 2: cities - consolidate conflicting policies
DROP POLICY IF EXISTS "public_can_view_cities" ON public.cities;
DROP POLICY IF EXISTS "Deny anonymous access to cities" ON public.cities;
-- Keep "Authenticated users can view cities" which already exists
