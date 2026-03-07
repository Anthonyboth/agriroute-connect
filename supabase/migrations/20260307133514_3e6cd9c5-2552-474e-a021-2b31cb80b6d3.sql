-- FRT-038: Add INSERT policy for credit_accounts so users can request credit
CREATE POLICY "credit_accounts_insert_own"
ON public.credit_accounts
FOR INSERT
TO authenticated
WITH CHECK (profile_id = get_my_profile_id());