-- ============================================================================
-- FIX 1: Atualizar get_platform_stats para incluir motoristas PENDING
-- Os motoristas são contados mesmo antes de aprovação para refletir cadastros
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(
  total_usuarios bigint, 
  total_fretes bigint, 
  peso_total numeric, 
  avaliacao_media numeric, 
  motoristas bigint, 
  produtores bigint, 
  prestadores bigint, 
  fretes_entregues bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total de usuários aprovados
    (SELECT COUNT(*) FROM profiles WHERE status = 'APPROVED')::bigint AS total_usuarios,
    -- Total de fretes
    (SELECT COUNT(*) FROM freights)::bigint AS total_fretes,
    -- Peso total entregue (em kg)
    COALESCE((SELECT SUM(weight) FROM freights WHERE status = 'DELIVERED'), 0)::numeric AS peso_total,
    -- Média de avaliações
    COALESCE((SELECT AVG(rating) FROM ratings), 0)::numeric AS avaliacao_media,
    -- Motoristas: contar TODOS (APPROVED + PENDING) para refletir cadastros reais
    (SELECT COUNT(*) FROM profiles WHERE role IN ('MOTORISTA', 'MOTORISTA_AFILIADO'))::bigint AS motoristas,
    -- Produtores aprovados
    (SELECT COUNT(*) FROM profiles WHERE role = 'PRODUTOR' AND status = 'APPROVED')::bigint AS produtores,
    -- Prestadores aprovados
    (SELECT COUNT(*) FROM profiles WHERE role = 'PRESTADOR_SERVICOS' AND status = 'APPROVED')::bigint AS prestadores,
    -- Fretes entregues
    (SELECT COUNT(*) FROM freights WHERE status = 'DELIVERED')::bigint AS fretes_entregues;
END;
$function$;

-- Comentário de auditoria
COMMENT ON FUNCTION public.get_platform_stats() IS 
'Estatísticas da plataforma. Motoristas são contados independente de status (APPROVED/PENDING) para refletir todos os cadastros. Atualizado 2026-01-28.';

-- ============================================================================
-- FIX 2: Endurecer segurança da tabela vehicles
-- Remover acesso de assigned_driver_id para prevenir enumeração
-- Apenas proprietário direto, dono da transportadora, ou admin podem ver
-- ============================================================================

-- Dropar política antiga
DROP POLICY IF EXISTS "vehicles_select_owner_or_assigned" ON public.vehicles;

-- Criar política mais restrita (sem assigned_driver_id no SELECT)
CREATE POLICY "vehicles_select_owner_only"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  -- Proprietário direto do veículo
  driver_id = get_current_profile_id()
  -- OU dono da transportadora associada
  OR (
    company_id IS NOT NULL 
    AND company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = get_current_profile_id()
    )
  )
  -- OU administrador
  OR is_admin()
);

COMMENT ON POLICY "vehicles_select_owner_only" ON public.vehicles IS 
'Security fix 2026-01-28: Apenas proprietário direto, dono da transportadora, ou admin podem ver veículos. Previne enumeração de frota.';