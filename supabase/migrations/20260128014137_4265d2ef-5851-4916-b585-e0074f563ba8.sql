-- ============================================================================
-- FIX SECURITY: profiles_table_public_exposure
-- Corrigir política RLS da tabela profiles para que usuários só vejam seus 
-- próprios dados, e admins vejam todos
-- ============================================================================

-- Dropar políticas antigas que permitem acesso amplo
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_simple" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_only" ON public.profiles;

-- Criar política correta: usuários só veem SEU PRÓPRIO perfil
-- Usar has_role() que já existe no projeto
CREATE POLICY "profiles_select_own_only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Garantir que a política de UPDATE também está correta
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_only" ON public.profiles;

CREATE POLICY "profiles_update_own_only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Comentário de auditoria
COMMENT ON POLICY "profiles_select_own_only" ON public.profiles IS 
'Security fix 2026-01-28: Users can only view their own profile. Admins can view all profiles via has_role(). Fixes profiles_table_public_exposure vulnerability.';

COMMENT ON POLICY "profiles_update_own_only" ON public.profiles IS 
'Users can only update their own profile. No cross-user access allowed.';