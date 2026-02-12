
-- Drop all existing policies on service_provider_areas
DROP POLICY IF EXISTS "Authenticated users can view active service areas" ON public.service_provider_areas;
DROP POLICY IF EXISTS "Providers can manage their own service areas" ON public.service_provider_areas;
DROP POLICY IF EXISTS "service_areas_manage_own" ON public.service_provider_areas;
DROP POLICY IF EXISTS "service_areas_select_auth" ON public.service_provider_areas;

-- Recreate with proper TO authenticated restriction
CREATE POLICY "service_areas_select_authenticated"
ON public.service_provider_areas
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "service_areas_manage_own"
ON public.service_provider_areas
FOR ALL
TO authenticated
USING (provider_id IN (
  SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
))
WITH CHECK (provider_id IN (
  SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
));
