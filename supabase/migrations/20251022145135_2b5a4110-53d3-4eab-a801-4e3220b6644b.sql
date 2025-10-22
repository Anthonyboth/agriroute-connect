-- ============================================
-- FIX CRÍTICO: RLS user_devices - Force drop and recreate
-- ============================================

-- Force drop ALL policies on user_devices
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_devices' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.user_devices';
    END LOOP;
END $$;

-- Force drop ALL policies on cities
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'cities' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.cities';
    END LOOP;
END $$;

-- ============================================
-- NEW SECURE POLICIES FOR user_devices
-- ============================================

-- INSERT: Allow authenticated users to register devices
CREATE POLICY "users_insert_own_devices"
ON public.user_devices
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Only see your own devices
CREATE POLICY "users_select_own_devices"
ON public.user_devices
FOR SELECT
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- UPDATE: Only update your own devices
CREATE POLICY "users_update_own_devices"
ON public.user_devices
FOR UPDATE
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- DELETE: Only delete your own devices
CREATE POLICY "users_delete_own_devices"
ON public.user_devices
FOR DELETE
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- ============================================
-- TRIGGER TO ENFORCE user_id ON INSERT
-- ============================================

CREATE OR REPLACE FUNCTION public.ensure_device_user_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id INTO NEW.user_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF NEW.user_id IS NULL THEN
    RAISE WARNING 'Device registered before profile exists: auth.uid=%', auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS ensure_device_user_id_trigger ON public.user_devices;

CREATE TRIGGER ensure_device_user_id_trigger
  BEFORE INSERT ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_device_user_id();

-- ============================================
-- FIX cities TABLE
-- ============================================

CREATE POLICY "service_role_manages_cities"
ON public.cities
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "public_can_view_cities"
ON public.cities
FOR SELECT
USING (true);