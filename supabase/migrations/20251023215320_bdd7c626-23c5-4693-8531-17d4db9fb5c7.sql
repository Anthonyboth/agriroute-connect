-- ============================================
-- RLS Policies for company_driver_chats
-- ============================================

-- Drop old conflicting policies
DROP POLICY IF EXISTS "companies_view_chats" ON public.company_driver_chats;
DROP POLICY IF EXISTS "drivers_view_chats" ON public.company_driver_chats;
DROP POLICY IF EXISTS "companies_insert_chats" ON public.company_driver_chats;
DROP POLICY IF EXISTS "drivers_insert_chats" ON public.company_driver_chats;

-- New consolidated policies
DROP POLICY IF EXISTS "cdc_select_by_participants" ON public.company_driver_chats;
DROP POLICY IF EXISTS "cdc_insert_by_company_owner" ON public.company_driver_chats;
DROP POLICY IF EXISTS "cdc_insert_by_driver" ON public.company_driver_chats;
DROP POLICY IF EXISTS "cdc_mark_read_by_recipient" ON public.company_driver_chats;

CREATE POLICY "cdc_select_by_participants"
ON public.company_driver_chats
FOR SELECT
TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "cdc_insert_by_company_owner"
ON public.company_driver_chats
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'COMPANY'
  AND EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "cdc_insert_by_driver"
ON public.company_driver_chats
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'DRIVER'
  AND driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.company_drivers cd
    WHERE cd.company_id = company_id
    AND cd.driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND COALESCE(cd.status, 'APPROVED') IN ('APPROVED', 'ACTIVE')
  )
);

CREATE POLICY "cdc_mark_read_by_recipient"
ON public.company_driver_chats
FOR UPDATE
TO authenticated
USING (
  (sender_type = 'DRIVER' AND EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ))
  OR
  (sender_type = 'COMPANY' AND driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
)
WITH CHECK (true);