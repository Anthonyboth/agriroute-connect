-- Fix RLS INSERT policy for transport_companies (was blocking company creation)
-- The previous policy used can_manage_company(auth.uid(), id) in WITH CHECK.
-- During INSERT the row doesn't exist yet, so that check fails and causes "new row violates row-level security".

DROP POLICY IF EXISTS companies_insert ON public.transport_companies;

CREATE POLICY companies_insert
ON public.transport_companies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = transport_companies.profile_id
      AND p.user_id = auth.uid()
  )
);
