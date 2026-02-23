
-- 1. Make service-chat-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'service-chat-images';

-- 2. Restrict badge system INSERT to service_role only
DROP POLICY IF EXISTS "System inserts driver badges" ON public.driver_badges;
CREATE POLICY "System inserts driver badges"
  ON public.driver_badges FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Restrict driver_levels ALL to service_role only
DROP POLICY IF EXISTS "System manages driver levels" ON public.driver_levels;
CREATE POLICY "System manages driver levels"
  ON public.driver_levels FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Allow authenticated users to READ their own badges
CREATE POLICY "Users can view their own badges"
  ON public.driver_badges FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- 5. Allow authenticated users to READ their own level
CREATE POLICY "Users can view their own level"
  ON public.driver_levels FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());
