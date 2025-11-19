-- ============================================
-- FASE 2: Políticas RLS para auto_confirm_logs
-- Problema: Tabela tem RLS ativado mas sem políticas
-- ============================================

-- 1. Política de SELECT - Apenas admins
CREATE POLICY "Admins can view auto-confirmation logs"
ON public.auto_confirm_logs
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Política de INSERT - Service role apenas (sistema)
CREATE POLICY "System can insert auto-confirmation logs"
ON public.auto_confirm_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NULL -- Apenas via service role
);

-- 3. Política de UPDATE - Apenas admins
CREATE POLICY "Admins can update auto-confirmation logs"
ON public.auto_confirm_logs
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. DELETE bloqueado (logs devem ser imutáveis)
-- Sem política de DELETE = ninguém pode deletar

COMMENT ON TABLE public.auto_confirm_logs IS 
'Logs de confirmação automática de entregas. Protegido por RLS - apenas admins visualizam, sistema insere, admins atualizam.';