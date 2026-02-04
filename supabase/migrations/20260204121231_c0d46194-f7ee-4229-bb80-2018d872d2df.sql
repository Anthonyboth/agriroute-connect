
-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA: Adicionar roles faltantes e corrigir 17 políticas RLS
-- ============================================================

-- 1. Adicionar roles faltantes ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'carrier';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'affiliated_driver';
