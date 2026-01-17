-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - driver_location_history
-- Problema: políticas comparavam driver_profile_id com auth.uid()
-- mas auth.uid() retorna user_id, não profile_id
-- =====================================================

-- 1. Remover políticas existentes (podem já ter sido removidas)
DROP POLICY IF EXISTS "No direct read access" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_history_owner_select" ON public.driver_location_history;
DROP POLICY IF EXISTS "driver_location_history_service_insert" ON public.driver_location_history;

-- 2. Criar função helper para obter profile_id do usuário atual (se não existir)
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- 3. Política SELECT: Motorista vê apenas sua própria localização OU produtor do frete
CREATE POLICY "driver_location_history_select_owner_or_freight_producer"
ON public.driver_location_history
FOR SELECT
TO authenticated
USING (
  -- O motorista pode ver sua própria localização
  driver_profile_id = public.get_current_profile_id()
  OR
  -- O produtor do frete pode ver a localização do motorista durante o frete ativo
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = driver_location_history.freight_id
    AND f.producer_id = public.get_current_profile_id()
    AND f.status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED')
  )
  OR
  -- Admin pode ver tudo
  public.has_role(auth.uid(), 'admin')
);

-- 4. Política INSERT: Apenas o próprio motorista (autenticado)
CREATE POLICY "driver_location_history_insert_owner"
ON public.driver_location_history
FOR INSERT
TO authenticated
WITH CHECK (
  driver_profile_id = public.get_current_profile_id()
);

-- 5. Política INSERT para service_role (edge functions)
CREATE POLICY "driver_location_history_insert_service_role"
ON public.driver_location_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- 6. Política DELETE: Apenas admin ou o próprio motorista para dados expirados
CREATE POLICY "driver_location_history_delete_owner_expired"
ON public.driver_location_history
FOR DELETE
TO authenticated
USING (
  (driver_profile_id = public.get_current_profile_id() AND expires_at < now())
  OR
  public.has_role(auth.uid(), 'admin')
);

-- 7. Adicionar comentário explicativo
COMMENT ON TABLE public.driver_location_history IS 
'Histórico de localização GPS de motoristas. Dados sensíveis protegidos por RLS: 
- Motorista vê apenas sua própria localização
- Produtor vê localização apenas de fretes ativos/concluídos que criou
- Dados expiram automaticamente (expires_at)
- Admin tem acesso completo para auditoria';