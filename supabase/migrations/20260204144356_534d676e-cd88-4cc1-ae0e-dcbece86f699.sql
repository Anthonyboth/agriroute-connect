-- =============================================================================
-- CORREÇÕES DE SEGURANÇA - RLS Policies (v2)
-- Objetivo: Remover políticas duplicadas/incorretas e fortalecer acesso
-- =============================================================================

-- 1. DRIVER_STRIPE_ACCOUNTS: Remover política incorreta que compara driver_id com auth.uid()
-- A política correta usa get_my_profile_id_for_pii()
DROP POLICY IF EXISTS "driver_stripe_accounts_owner_select" ON public.driver_stripe_accounts;

-- 2. Remover política duplicada antiga (roles:{public} deveria ser authenticated)
DROP POLICY IF EXISTS "Drivers can view their stripe accounts" ON public.driver_stripe_accounts;

-- 3. PROFILES_ENCRYPTED_DATA: A política pii_delete_cascade usando roles:{public} é necessária
-- para cleanup, mas precisa ser mais restritiva
DROP POLICY IF EXISTS "pii_delete_cascade" ON public.profiles_encrypted_data;

-- Recriar com condição mais restritiva (apenas para service role ou quando profile não existe)
CREATE POLICY "pii_delete_cascade" 
ON public.profiles_encrypted_data
FOR DELETE
TO public
USING (
  -- Permitir apenas quando profile já não existe (cascade cleanup)
  NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = profiles_encrypted_data.id)
  -- OU quando é service role
  OR is_service_role()
);

-- 4. MDF-E: Ajustar política para usar authenticated ao invés de public
DROP POLICY IF EXISTS "mdfe_manifestos_select" ON public.mdfe_manifestos;
DROP POLICY IF EXISTS "mdfe_manifestos_insert" ON public.mdfe_manifestos;
DROP POLICY IF EXISTS "mdfe_manifestos_update" ON public.mdfe_manifestos;

-- Recriar políticas com role correto (authenticated)
CREATE POLICY "mdfe_manifestos_select" 
ON public.mdfe_manifestos
FOR SELECT
TO authenticated
USING (
  -- Emissor pode ver
  emitted_by_id = get_current_profile_id()
  -- Participantes do frete podem ver
  OR EXISTS (
    SELECT 1 FROM freights f
    WHERE f.id = mdfe_manifestos.freight_id
    AND (
      f.producer_id = get_current_profile_id()
      OR f.driver_id = get_current_profile_id()
    )
  )
  -- Dono da empresa pode ver
  OR EXISTS (
    SELECT 1 FROM transport_companies tc
    WHERE tc.id = mdfe_manifestos.company_id
    AND tc.profile_id = get_current_profile_id()
  )
  -- Admin pode ver tudo
  OR is_admin()
);

CREATE POLICY "mdfe_manifestos_insert" 
ON public.mdfe_manifestos
FOR INSERT
TO authenticated
WITH CHECK (
  -- Apenas o emissor pode criar
  emitted_by_id = get_current_profile_id()
  -- E deve ser participante do frete
  AND EXISTS (
    SELECT 1 FROM freights f
    WHERE f.id = mdfe_manifestos.freight_id
    AND (
      f.producer_id = get_current_profile_id()
      OR f.driver_id = get_current_profile_id()
      OR f.company_id = mdfe_manifestos.company_id
    )
  )
);

CREATE POLICY "mdfe_manifestos_update" 
ON public.mdfe_manifestos
FOR UPDATE
TO authenticated
USING (
  emitted_by_id = get_current_profile_id() 
  OR is_admin()
)
WITH CHECK (
  emitted_by_id = get_current_profile_id() 
  OR is_admin()
);

-- 5. Adicionar política de service role (sem IF NOT EXISTS)
-- Primeiro dropar se existir
DROP POLICY IF EXISTS "driver_stripe_service_select" ON public.driver_stripe_accounts;

-- Criar política para service role
CREATE POLICY "driver_stripe_service_select" 
ON public.driver_stripe_accounts
FOR SELECT
TO public
USING (is_service_role());