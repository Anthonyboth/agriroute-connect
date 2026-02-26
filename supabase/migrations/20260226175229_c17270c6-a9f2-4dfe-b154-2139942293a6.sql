
-- Fix gta_interstate_rules: restrict public read to authenticated users only
DROP POLICY IF EXISTS "Leitura publica regras interestaduais" ON public.gta_interstate_rules;

CREATE POLICY "Leitura autenticada regras interestaduais"
ON public.gta_interstate_rules
FOR SELECT
TO authenticated
USING (is_active = true);
