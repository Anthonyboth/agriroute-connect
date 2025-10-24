-- Fix RLS policies for company_driver_chats, company_vehicle_assignments, and company_drivers
-- WITHOUT recreating functions (they already exist)

-- 1. Fix company_driver_chats policies - remove duplicates and fix logic
DROP POLICY IF EXISTS "chat_insert_company_v2" ON public.company_driver_chats;
DROP POLICY IF EXISTS "chat_insert_driver_v2" ON public.company_driver_chats;
DROP POLICY IF EXISTS "chat_select_v2" ON public.company_driver_chats;
DROP POLICY IF EXISTS "chat_update_read_v2" ON public.company_driver_chats;

-- Recreate the driver insert policy with corrected logic
DROP POLICY IF EXISTS "cdc_insert_by_driver" ON public.company_driver_chats;
CREATE POLICY "cdc_insert_by_driver" ON public.company_driver_chats
FOR INSERT
WITH CHECK (
  sender_type = 'DRIVER'
  AND driver_profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM company_drivers cd
    WHERE cd.driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND cd.company_id = company_driver_chats.company_id
    AND cd.status IN ('APPROVED', 'ACTIVE')
  )
);

-- 2. Fix company_vehicle_assignments - recreate policies with better logic
DROP POLICY IF EXISTS "drivers_view_own_vehicle_assignments" ON public.company_vehicle_assignments;
DROP POLICY IF EXISTS "admins_view_all_vehicle_assignments" ON public.company_vehicle_assignments;
DROP POLICY IF EXISTS "company_manages_vehicle_assignments" ON public.company_vehicle_assignments;

-- Allow drivers to see their own assignments
CREATE POLICY "drivers_view_own_vehicle_assignments" ON public.company_vehicle_assignments
FOR SELECT
USING (
  driver_profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND removed_at IS NULL
);

-- Allow admins to view all
CREATE POLICY "admins_view_all_vehicle_assignments" ON public.company_vehicle_assignments
FOR SELECT
USING (is_admin());

-- Allow companies to manage ALL operations (INSERT, UPDATE, DELETE)
CREATE POLICY "company_manages_vehicle_assignments" ON public.company_vehicle_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_vehicle_assignments.company_id
    AND p.user_id = auth.uid()
  )
  OR is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_vehicle_assignments.company_id
    AND p.user_id = auth.uid()
  )
  OR is_admin()
);

-- 3. Fix company_drivers policies - recreate with inline logic instead of functions
DROP POLICY IF EXISTS "company_drivers_select" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_insert" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_update" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_delete" ON public.company_drivers;

-- Allow SELECT for company owners, drivers themselves, and admins
CREATE POLICY "company_drivers_select" ON public.company_drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_drivers.company_id
    AND p.user_id = auth.uid()
  )
  OR driver_profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR is_admin()
);

-- Allow INSERT for company owners and drivers (PENDING status only)
CREATE POLICY "company_drivers_insert" ON public.company_drivers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_drivers.company_id
    AND p.user_id = auth.uid()
  )
  OR (
    driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND status = 'PENDING'
  )
  OR is_admin()
);

-- Allow UPDATE for company owners and admins
CREATE POLICY "company_drivers_update" ON public.company_drivers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_drivers.company_id
    AND p.user_id = auth.uid()
  )
  OR is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_drivers.company_id
    AND p.user_id = auth.uid()
  )
  OR is_admin()
);

-- Allow DELETE for company owners and admins
CREATE POLICY "company_drivers_delete" ON public.company_drivers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE tc.id = company_drivers.company_id
    AND p.user_id = auth.uid()
  )
  OR is_admin()
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_drivers_lookup 
ON public.company_drivers(company_id, driver_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_transport_companies_profile 
ON public.transport_companies(profile_id);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles(user_id);