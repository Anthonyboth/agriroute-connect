-- =========================================
-- FASE 1: Corrigir RLS de user_devices
-- =========================================

-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Authenticated users can register devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can update their devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can delete their devices" ON public.user_devices;

-- Criar políticas corretas baseadas em profile_id
CREATE POLICY "Users can register their own devices"
ON public.user_devices
FOR INSERT
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their own devices"
ON public.user_devices
FOR SELECT
USING (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own devices"
ON public.user_devices
FOR UPDATE
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own devices"
ON public.user_devices
FOR DELETE
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- =========================================
-- FASE 2: Corrigir schema de error_logs
-- =========================================

-- Verificar e adicionar colunas faltantes
DO $$ 
BEGIN
  -- Verificar se auto_correction_attempted existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'error_logs' 
    AND column_name = 'auto_correction_attempted'
  ) THEN
    ALTER TABLE public.error_logs 
    ADD COLUMN auto_correction_attempted boolean DEFAULT false;
  END IF;

  -- Verificar se auto_correction_action existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'error_logs' 
    AND column_name = 'auto_correction_action'
  ) THEN
    ALTER TABLE public.error_logs 
    ADD COLUMN auto_correction_action text;
  END IF;

  -- Verificar se auto_correction_success existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'error_logs' 
    AND column_name = 'auto_correction_success'
  ) THEN
    ALTER TABLE public.error_logs 
    ADD COLUMN auto_correction_success boolean;
  END IF;
END $$;

-- =========================================
-- FASE 3: Corrigir fretes com metadata inconsistente
-- =========================================

-- Corrigir fretes que têm metadata de confirmação mas status errado
UPDATE public.freights
SET 
  status = 'DELIVERED',
  updated_at = NOW()
WHERE 
  status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION')
  AND (
    metadata->>'delivery_confirmed_at' IS NOT NULL
    OR metadata->>'confirmed_by_producer' = 'true'
    OR metadata->>'confirmed_by_producer_at' IS NOT NULL
    OR metadata->>'delivery_confirmed_by_producer' = 'true'
  );