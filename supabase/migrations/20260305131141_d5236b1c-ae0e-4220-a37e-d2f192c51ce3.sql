-- 1. Deny anon on freight_messages
CREATE POLICY "freight_messages_deny_anon"
ON public.freight_messages
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. Fix freight_chat_participants: drop buggy policy using auth.uid() for participant_id (should be profile_id)
DROP POLICY IF EXISTS "freight_chat_participants_member_select" ON public.freight_chat_participants;

-- 3. Deny anon on freight_chat_participants  
CREATE POLICY "freight_chat_participants_deny_anon"
ON public.freight_chat_participants
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 4. Recreate member select with correct profile resolution
CREATE POLICY "freight_chat_participants_member_select"
ON public.freight_chat_participants
FOR SELECT
TO authenticated
USING (
  participant_id = get_current_profile_id()
  OR has_role(auth.uid(), 'admin'::app_role)
);