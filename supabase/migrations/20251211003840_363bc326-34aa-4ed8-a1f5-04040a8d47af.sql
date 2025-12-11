
-- =====================================================
-- FASE 1: CORREÇÕES CRÍTICAS DE RLS PARA PROTEÇÃO DE DADOS
-- =====================================================

-- =====================================================
-- 1. TABELA PROFILES - Restringir acesso a dados sensíveis
-- =====================================================

-- Remover política SELECT que permite acesso público
DROP POLICY IF EXISTS "profiles_select_own_or_admin_or_company_driver" ON public.profiles;

-- Criar nova política SELECT mais restritiva (apenas authenticated)
CREATE POLICY "profiles_select_authenticated_restricted"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Usuário pode ver próprio perfil
  user_id = auth.uid()
  -- OU é admin
  OR has_role(auth.uid(), 'admin'::app_role)
  -- OU motorista é visível para transportadora (relacionamento comercial)
  OR is_driver_visible_for_company(id)
  -- OU existe relacionamento de frete entre as partes
  OR EXISTS (
    SELECT 1 FROM freights f
    WHERE f.producer_id = profiles.id 
    AND f.driver_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    AND f.status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED')
  )
  OR EXISTS (
    SELECT 1 FROM freights f
    WHERE f.driver_id = profiles.id 
    AND f.producer_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    AND f.status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED')
  )
);

-- =====================================================
-- 2. TABELA PROSPECT_USERS - Restringir acesso a dados de leads
-- =====================================================

-- Remover política extremamente permissiva
DROP POLICY IF EXISTS "System can manage prospect users" ON public.prospect_users;

-- Manter política de visualização admin (já existe), mas garantir que seja authenticated
DROP POLICY IF EXISTS "Admins can view prospect users" ON public.prospect_users;

-- Criar política de visualização apenas para admins autenticados
CREATE POLICY "Admins can view prospect users"
ON public.prospect_users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar política de INSERT apenas para service_role (Edge Functions)
CREATE POLICY "Service role can insert prospect users"
ON public.prospect_users
FOR INSERT
TO service_role
WITH CHECK (true);

-- Criar política de UPDATE apenas para service_role
CREATE POLICY "Service role can update prospect users"
ON public.prospect_users
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Criar política de DELETE apenas para admins
CREATE POLICY "Admins can delete prospect users"
ON public.prospect_users
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 3. TABELA TELEGRAM_MESSAGE_QUEUE - Proteger logs internos
-- =====================================================

-- Remover política extremamente permissiva
DROP POLICY IF EXISTS "System can manage telegram queue" ON public.telegram_message_queue;

-- Criar política de INSERT apenas para service_role (Edge Functions podem inserir)
CREATE POLICY "Service role can insert telegram messages"
ON public.telegram_message_queue
FOR INSERT
TO service_role
WITH CHECK (true);

-- Criar política de UPDATE apenas para service_role
CREATE POLICY "Service role can update telegram messages"
ON public.telegram_message_queue
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Criar política de SELECT apenas para admins autenticados
CREATE POLICY "Admins can view telegram queue"
ON public.telegram_message_queue
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar política de DELETE apenas para admins
CREATE POLICY "Admins can delete telegram messages"
ON public.telegram_message_queue
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 4. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================================

COMMENT ON POLICY "profiles_select_authenticated_restricted" ON public.profiles IS 
'Política restritiva: usuários veem apenas próprio perfil, admins veem todos, relacionamentos comerciais ativos permitem visualização mútua';

COMMENT ON POLICY "Admins can view prospect users" ON public.prospect_users IS 
'Apenas administradores autenticados podem visualizar dados de leads/prospects';

COMMENT ON POLICY "Admins can view telegram queue" ON public.telegram_message_queue IS 
'Apenas administradores podem ver logs de mensagens Telegram - protege informações internas do sistema';
