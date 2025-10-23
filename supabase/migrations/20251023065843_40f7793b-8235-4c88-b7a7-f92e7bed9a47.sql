-- =====================================================
-- CORREÇÃO DEFINITIVA: Recursão Infinita em Profiles RLS
-- =====================================================

-- PASSO 1: Criar funções SECURITY DEFINER (sem recursão!)
CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer uuid, _target_profile uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _target_profile = _viewer
    OR public.has_role(_viewer, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.company_drivers cd
      JOIN public.transport_companies tc ON tc.id = cd.company_id
      WHERE tc.profile_id = _viewer
        AND cd.driver_profile_id = _target_profile
        AND cd.status IN ('ACTIVE', 'PENDING')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_profile_owner(_viewer uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _profile_id AND user_id = _viewer
  );
$$;

-- PASSO 2: Dropar TODAS policies em profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname LIKE '%select%' OR policyname LIKE '%view%')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- PASSO 3: Criar policy unificada em profiles
CREATE POLICY "select_can_view_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(auth.uid(), id));

-- PASSO 4: Dropar e recriar policies em company_drivers
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_drivers')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.company_drivers';
    END LOOP;
END $$;

CREATE POLICY company_drivers_select ON public.company_drivers
FOR SELECT TO authenticated
USING (public.can_manage_company(auth.uid(), company_id) OR public.is_profile_owner(auth.uid(), driver_profile_id) OR public.is_admin());

CREATE POLICY company_drivers_insert ON public.company_drivers
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_company(auth.uid(), company_id) OR (public.is_profile_owner(auth.uid(), driver_profile_id) AND status = 'PENDING') OR public.is_admin());

CREATE POLICY company_drivers_update ON public.company_drivers
FOR UPDATE TO authenticated
USING (public.can_manage_company(auth.uid(), company_id) OR public.is_admin())
WITH CHECK (public.can_manage_company(auth.uid(), company_id) OR public.is_admin());

CREATE POLICY company_drivers_delete ON public.company_drivers
FOR DELETE TO authenticated
USING (public.can_manage_company(auth.uid(), company_id) OR public.is_admin());

-- PASSO 5: Dropar e recriar policies em user_devices
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_devices')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.user_devices';
    END LOOP;
END $$;

CREATE POLICY users_select_own_devices ON public.user_devices
FOR SELECT TO authenticated
USING (public.is_profile_owner(auth.uid(), user_id));

CREATE POLICY users_insert_own_devices ON public.user_devices
FOR INSERT TO authenticated
WITH CHECK (public.is_profile_owner(auth.uid(), user_id));

CREATE POLICY users_update_own_devices ON public.user_devices
FOR UPDATE TO authenticated
USING (public.is_profile_owner(auth.uid(), user_id))
WITH CHECK (public.is_profile_owner(auth.uid(), user_id));

CREATE POLICY users_delete_own_devices ON public.user_devices
FOR DELETE TO authenticated
USING (public.is_profile_owner(auth.uid(), user_id));