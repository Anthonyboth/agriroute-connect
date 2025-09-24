-- Política RLS para permitir que prestadores aceitem solicitações pendentes
-- O problema atual é que prestadores não conseguem aceitar solicitações porque
-- a política só permite atualizar quando provider_id já está definido

-- Remover política restritiva atual que impede aceitar solicitações
DROP POLICY IF EXISTS final_providers_update_service_requests ON service_requests;

-- Criar nova política que permite:
-- 1. Prestadores atualizarem suas próprias solicitações já aceitas
-- 2. Prestadores aceitarem solicitações pendentes (provider_id NULL)
CREATE POLICY providers_can_accept_and_update_service_requests 
ON service_requests 
FOR UPDATE 
USING (
  -- Pode atualizar se já é o provider da solicitação
  provider_id IN (
    SELECT sp.profile_id
    FROM service_providers sp
    WHERE sp.profile_id IN (
      SELECT profiles.id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
  OR
  -- Pode aceitar solicitação pendente (provider_id é NULL e status é OPEN)
  (
    provider_id IS NULL 
    AND status = 'OPEN'
    AND EXISTS (
      SELECT 1 
      FROM service_providers sp
      WHERE sp.profile_id IN (
        SELECT profiles.id
        FROM profiles
        WHERE profiles.user_id = auth.uid()
      )
    )
  )
  OR 
  is_admin()
)
WITH CHECK (
  -- Só pode definir provider_id como seu próprio profile_id
  provider_id IN (
    SELECT sp.profile_id
    FROM service_providers sp
    WHERE sp.profile_id IN (
      SELECT profiles.id
      FROM profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
  OR is_admin()
);