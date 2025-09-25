-- CORREÇÃO CRÍTICA DE SEGURANÇA - FINAL
-- Remove apenas políticas RLS permissivas

-- 1. CORRIGIR CONFLITOS DE RLS NA TABELA PROFILES
DROP POLICY IF EXISTS "Users can view profiles when authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view own profile" ON public.profiles;
CREATE POLICY "Users can only view own profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- 2. GARANTIR POLÍTICAS SEGURAS PARA FREIGHTS
DROP POLICY IF EXISTS "Users can only view their own freights" ON public.freights;
CREATE POLICY "Users can only view their own freights" ON public.freights
FOR SELECT USING (
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) 
  OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_admin()
);

DROP POLICY IF EXISTS "Users can only create their own freights" ON public.freights;  
CREATE POLICY "Users can only create their own freights" ON public.freights
FOR INSERT WITH CHECK (
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can only update their own freights" ON public.freights;
CREATE POLICY "Users can only update their own freights" ON public.freights
FOR UPDATE USING (
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_admin()
);

-- 3. ADICIONAR AUDITORIA DE SEGURANÇA
INSERT INTO audit_logs (
  table_name,
  operation,
  user_id,
  new_data,
  timestamp
) VALUES (
  'security_fixes',
  'SECURITY_PATCH_APPLIED',
  auth.uid(),
  '{"patch": "rls_policies_fixed", "timestamp": "2025-01-25T20:22:00Z"}'::jsonb,
  now()
);