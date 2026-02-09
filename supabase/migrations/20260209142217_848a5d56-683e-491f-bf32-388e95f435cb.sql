
-- Remove a policy pública de SELECT
DROP POLICY IF EXISTS "Anyone view active packages" ON public.emission_packages;

-- Cria nova policy restrita a usuários autenticados
CREATE POLICY "Authenticated users view active packages"
ON public.emission_packages
FOR SELECT
USING (is_active = true AND auth.role() = 'authenticated');
