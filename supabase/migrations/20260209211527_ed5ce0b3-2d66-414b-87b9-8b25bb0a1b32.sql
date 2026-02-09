-- Remove the overly permissive public policy
DROP POLICY IF EXISTS "Anyone view active rules" ON public.antifraud_nfe_rules;

-- The existing 'antifraud_rules_authenticated_select' policy already restricts to authenticated users
-- Verify it's scoped correctly by recreating it with explicit TO clause
DROP POLICY IF EXISTS "antifraud_rules_authenticated_select" ON public.antifraud_nfe_rules;

CREATE POLICY "antifraud_rules_authenticated_select"
ON public.antifraud_nfe_rules FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
