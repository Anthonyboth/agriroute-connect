
-- =============================================
-- FIX CRÍTICO: Restaurar SELECT na tabela profiles
-- =============================================
-- O REVOKE SELECT de nível de tabela quebra cascatas de RLS policies
-- em freight_proposals, freights, service_requests e todas as tabelas
-- que usam subqueries em profiles (ex: WHERE user_id = auth.uid()).
-- A proteção de PII é feita via view profiles_secure + RLS, não via CLS.
-- =============================================

-- 1. Restaurar SELECT de nível de tabela para authenticated
GRANT SELECT ON public.profiles TO authenticated;

-- 2. Manter anon bloqueado (profiles não devem ser lidos por anônimos)
REVOKE ALL ON public.profiles FROM anon;

-- 3. Garantir INSERT e UPDATE para authenticated (controlados por RLS)
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- 4. Verificar que vehicles e service_requests também estão OK
-- vehicles: já tem SELECT para authenticated
-- service_requests: restaurar se necessário
GRANT SELECT ON public.vehicles TO authenticated;
GRANT SELECT ON public.service_requests TO authenticated;
GRANT INSERT ON public.service_requests TO authenticated;
GRANT UPDATE ON public.service_requests TO authenticated;

-- 5. Garantir que a deny policy para anon ainda existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Deny anonymous access to profiles'
  ) THEN
    CREATE POLICY "Deny anonymous access to profiles"
    ON public.profiles FOR ALL
    TO anon
    USING (false);
  END IF;
END $$;
