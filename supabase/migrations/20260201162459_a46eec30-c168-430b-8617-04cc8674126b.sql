-- ================================================================
-- CORRIGIR POLÍTICA RLS: driver_location_history
-- Adicionar suporte para transportadoras visualizarem
-- a localização de motoristas afiliados em fretes ativos
-- ================================================================

-- 1. Remover política existente de SELECT (se existir após falha anterior)
DROP POLICY IF EXISTS "driver_location_history_select_secure" ON public.driver_location_history;

-- 2. Criar política corrigida que inclui transportadoras
-- Quem pode visualizar:
-- a) O próprio motorista (dono do registro)
-- b) Administradores
-- c) Produtor do frete (se frete ativo e captura recente <1h)
-- d) Transportadora do frete (via freight_assignments.company_id e transport_companies.profile_id)
CREATE POLICY "driver_location_history_select_secure"
ON public.driver_location_history
FOR SELECT
TO authenticated
USING (
  -- a) Dono do registro (motorista)
  driver_profile_id = get_current_profile_id()
  
  -- b) Admin
  OR has_role(auth.uid(), 'admin')
  
  -- c) Produtor com frete ativo (captura <1h)
  OR (
    freight_id IS NOT NULL
    AND captured_at > (now() - INTERVAL '1 hour')
    AND EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = driver_location_history.freight_id
        AND f.producer_id = get_current_profile_id()
        AND f.status IN ('ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'OPEN')
    )
  )
  
  -- d) Transportadora com motorista atribuído ao frete
  OR (
    freight_id IS NOT NULL
    AND captured_at > (now() - INTERVAL '1 hour')
    AND EXISTS (
      SELECT 1 FROM freight_assignments fa
      JOIN transport_companies tc ON tc.id = fa.company_id
      WHERE fa.freight_id = driver_location_history.freight_id
        AND fa.driver_id = driver_location_history.driver_profile_id
        AND fa.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'PENDING')
        AND tc.profile_id = get_current_profile_id()
    )
  )
);

-- 3. Adicionar comentário explicativo
COMMENT ON POLICY "driver_location_history_select_secure" ON public.driver_location_history IS 
'Restringe acesso ao histórico de localização: 
- Motorista vê seu próprio histórico
- Admin vê tudo
- Produtor vê histórico de motoristas em fretes ativos (captura <1h)
- Transportadora vê histórico de seus motoristas atribuídos (captura <1h)';