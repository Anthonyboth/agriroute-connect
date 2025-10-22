-- ============================================
-- FIX CRÍTICO: RLS user_devices para permitir registro durante signup
-- ============================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can insert own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can delete own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can delete their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Authenticated users can register devices" ON public.user_devices;
DROP POLICY IF EXISTS "System can insert cities" ON public.cities;

-- ============================================
-- NEW SECURE POLICIES FOR user_devices
-- ============================================

-- INSERT: Allow any authenticated user to register a device with their own user_id
-- This must NOT require profile to exist first (signup flow)
CREATE POLICY "Users can register their devices"
ON public.user_devices
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- SELECT: Only see your own devices
CREATE POLICY "Users can view their devices"
ON public.user_devices
FOR SELECT
USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- UPDATE: Only update your own devices
CREATE POLICY "Users can update their devices"
ON public.user_devices
FOR UPDATE
USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- DELETE: Only delete your own devices
CREATE POLICY "Users can delete their devices"
ON public.user_devices
FOR DELETE
USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ============================================
-- ADD TRIGGER TO ENFORCE user_id ON INSERT
-- ============================================

-- This trigger forces user_id to match the authenticated user's profile
-- Prevents client from injecting another user's ID
CREATE OR REPLACE FUNCTION public.ensure_device_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the profile ID for the authenticated user
  SELECT id INTO NEW.user_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- If profile doesn't exist yet (signup), allow but warn
  IF NEW.user_id IS NULL THEN
    RAISE WARNING 'Device registered before profile exists: auth.uid=%', auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS ensure_device_user_id_trigger ON public.user_devices;

-- Create trigger
CREATE TRIGGER ensure_device_user_id_trigger
  BEFORE INSERT ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_device_user_id();

-- ============================================
-- FIX cities TABLE (BONUS)
-- ============================================

-- Remove overly permissive city insert policy
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;

CREATE POLICY "Service role manages cities"
ON public.cities
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role'
);

-- Keep public read access
CREATE POLICY "Anyone can view cities"
ON public.cities
FOR SELECT
USING (true);