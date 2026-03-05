
-- Fix freights RLS policies: replace direct profiles subqueries with get_my_profile_id()
-- This prevents "permission denied for table profiles" caused by restrictive RLS on profiles

-- 1. producer_own_freights_select
DROP POLICY IF EXISTS "producer_own_freights_select" ON public.freights;
CREATE POLICY "producer_own_freights_select"
  ON public.freights FOR SELECT
  TO authenticated
  USING (producer_id = get_my_profile_id());

-- 2. producer_insert_own_freights
DROP POLICY IF EXISTS "producer_insert_own_freights" ON public.freights;
CREATE POLICY "producer_insert_own_freights"
  ON public.freights FOR INSERT
  TO authenticated
  WITH CHECK (producer_id = get_my_profile_id());

-- 3. producer_update_own_freights
DROP POLICY IF EXISTS "producer_update_own_freights" ON public.freights;
CREATE POLICY "producer_update_own_freights"
  ON public.freights FOR UPDATE
  TO authenticated
  USING (producer_id = get_my_profile_id());

-- 4. freights_update_status_parties
DROP POLICY IF EXISTS "freights_update_status_parties" ON public.freights;
CREATE POLICY "freights_update_status_parties"
  ON public.freights FOR UPDATE
  TO authenticated
  USING (driver_id = get_my_profile_id() OR producer_id = get_my_profile_id())
  WITH CHECK (driver_id = get_my_profile_id() OR producer_id = get_my_profile_id());

-- 5. marketplace_view_safe - replace profiles subquery for guest freight check
DROP POLICY IF EXISTS "marketplace_view_safe" ON public.freights;
CREATE POLICY "marketplace_view_safe"
  ON public.freights FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    AND status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION')
    AND (is_guest_freight = false OR driver_id = get_my_profile_id())
  );

-- 6. company_own_freights_select - replace profiles JOIN with get_my_profile_id()
DROP POLICY IF EXISTS "company_own_freights_select" ON public.freights;
CREATE POLICY "company_own_freights_select"
  ON public.freights FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM transport_companies c
      WHERE c.profile_id = get_my_profile_id()
        AND c.id = freights.company_id
    )
  );

-- 7. company_update_assigned_freights - same fix
DROP POLICY IF EXISTS "company_update_assigned_freights" ON public.freights;
CREATE POLICY "company_update_assigned_freights"
  ON public.freights FOR UPDATE
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM transport_companies c
      WHERE c.profile_id = get_my_profile_id()
        AND c.id = freights.company_id
    )
  );
