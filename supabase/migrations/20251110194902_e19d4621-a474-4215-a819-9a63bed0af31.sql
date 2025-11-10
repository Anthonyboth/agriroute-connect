-- ================================================
-- Migration: Fix RLS policies for user_devices
-- Problema: Policy usava auth.uid() diretamente mas user_devices.user_id referencia profiles.id
-- Solução: Buscar profile.id através de auth.uid() corretamente
-- ================================================

-- 1. Dropar policies antigas (se existirem)
DROP POLICY IF EXISTS "users_can_insert_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_can_read_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_can_update_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_can_delete_own_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_insert_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_select_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_update_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_delete_devices" ON public.user_devices;

-- 2. Habilitar RLS (se não estiver habilitado)
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- 3. Criar policies CORRETAS
-- INSERT: Permite inserir device se user_id corresponde ao profile do usuário autenticado
CREATE POLICY "authenticated_users_insert_own_devices"
ON public.user_devices
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- SELECT: Permite ver devices do próprio profile
CREATE POLICY "authenticated_users_select_own_devices"
ON public.user_devices
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- UPDATE: Permite atualizar devices do próprio profile
CREATE POLICY "authenticated_users_update_own_devices"
ON public.user_devices
FOR UPDATE
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- DELETE: Permite deletar devices do próprio profile
CREATE POLICY "authenticated_users_delete_own_devices"
ON public.user_devices
FOR DELETE
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- 4. Criar índices para melhorar performance das policies
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON public.user_devices(device_id);