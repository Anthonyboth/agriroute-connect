-- Create new policies with unique names
CREATE POLICY "chat_select_v2"
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

CREATE POLICY "chat_insert_company_v2"
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

CREATE POLICY "chat_insert_driver_v2"
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

CREATE POLICY "chat_update_read_v2"
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