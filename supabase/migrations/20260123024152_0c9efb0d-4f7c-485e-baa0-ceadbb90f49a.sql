
-- =============================================================================
-- AUDITORIA DE PRODUÇÃO: Correção de Status dos Emissores
-- Atualiza emissores com certificados válidos para o status correto
-- =============================================================================

-- Atualizar emissores que têm certificados válidos mas ainda estão em 'pending'
UPDATE fiscal_issuers 
SET 
  status = 'certificate_uploaded',
  updated_at = NOW()
WHERE status = 'pending'
  AND id IN (
    SELECT DISTINCT issuer_id 
    FROM fiscal_certificates 
    WHERE is_valid = true
  );
