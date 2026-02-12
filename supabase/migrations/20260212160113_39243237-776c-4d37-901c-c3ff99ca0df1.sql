
-- Restrict gta_state_rules to authenticated users only
DROP POLICY IF EXISTS "Regras de estado são públicas para leitura" ON public.gta_state_rules;

CREATE POLICY "Authenticated users can read state rules"
ON public.gta_state_rules
FOR SELECT
TO authenticated
USING (true);
