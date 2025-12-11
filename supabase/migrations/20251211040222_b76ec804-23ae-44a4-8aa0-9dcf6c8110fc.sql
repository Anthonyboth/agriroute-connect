-- =====================================================
-- CORREÇÃO URGENTE: Recursão Infinita RLS - Profiles
-- =====================================================

-- 1. Criar função SECURITY DEFINER para quebrar recursão
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Remover policy problemática que causa recursão
DROP POLICY IF EXISTS "profiles_select_authenticated_restricted" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_and_related" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 3. Criar policy SIMPLES sem recursão para profiles
CREATE POLICY "profiles_select_simple" ON public.profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 4. Corrigir policies de user_devices (usar função ao invés de subquery)
DROP POLICY IF EXISTS "authenticated_users_select_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "authenticated_users_insert_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "authenticated_users_update_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_can_manage_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update own devices" ON public.user_devices;

-- 5. Criar policies corrigidas para user_devices usando a função
CREATE POLICY "user_devices_select" ON public.user_devices
FOR SELECT TO authenticated
USING (user_id = public.get_current_profile_id());

CREATE POLICY "user_devices_insert" ON public.user_devices
FOR INSERT TO authenticated
WITH CHECK (user_id = public.get_current_profile_id());

CREATE POLICY "user_devices_update" ON public.user_devices
FOR UPDATE TO authenticated
USING (user_id = public.get_current_profile_id())
WITH CHECK (user_id = public.get_current_profile_id());

CREATE POLICY "user_devices_delete" ON public.user_devices
FOR DELETE TO authenticated
USING (user_id = public.get_current_profile_id());