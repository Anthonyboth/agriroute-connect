-- ============================================================================
-- MIGRATION: Limpar assignments automáticos de transportadoras
-- ============================================================================
-- OBJETIVO: Remover freight_assignments criados automaticamente quando
-- transportadoras aceitavam fretes. Agora, transportadoras devem compartilhar
-- fretes manualmente via ShareFreightToDriver para que motoristas afiliados
-- vejam os fretes em seus painéis.
-- ============================================================================

-- Deletar assignments automáticos de transportadoras
-- (criados pelo accept-freight-multiple antes desta correção)
DELETE FROM freight_assignments
WHERE 
  metadata->>'created_by' = 'accept-freight-multiple'
  AND metadata->>'is_company_assignment' = 'true'
  AND company_id IS NOT NULL
  AND created_at > '2025-01-01'
  AND status IN ('ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED');

-- Adicionar comentário explicativo para documentação
COMMENT ON TABLE freight_assignments IS 
'Freight assignments link drivers to specific freights. 
IMPORTANT: Transport companies must manually share freights with drivers via ShareFreightToDriver. 
Automatic assignment creation on freight acceptance is disabled for companies.';