
REVOKE ALL ON public.company_driver_chats FROM anon;

CREATE POLICY "Deny anon access to company_driver_chats"
ON public.company_driver_chats
AS RESTRICTIVE FOR ALL TO anon USING (false);

-- Fix driver insert policy: change from 'public' to 'authenticated'
DROP POLICY IF EXISTS "cdc_insert_by_driver" ON public.company_driver_chats;

CREATE POLICY "cdc_insert_by_driver"
ON public.company_driver_chats
FOR INSERT TO authenticated
WITH CHECK (driver_profile_id = get_my_profile_id());
