-- Adicionar constraint única para evitar múltiplas propostas ativas do mesmo motorista para o mesmo frete
-- Primeiro, vamos verificar se existe alguma duplicata e limpar
WITH duplicates AS (
  SELECT freight_id, driver_id, status, MIN(created_at) as first_created
  FROM freight_proposals 
  WHERE status IN ('PENDING', 'ACCEPTED')
  GROUP BY freight_id, driver_id, status
  HAVING COUNT(*) > 1
)
DELETE FROM freight_proposals fp
WHERE EXISTS (
  SELECT 1 FROM duplicates d 
  WHERE fp.freight_id = d.freight_id 
    AND fp.driver_id = d.driver_id 
    AND fp.status = d.status
    AND fp.created_at > d.first_created
);

-- Criar constraint única para evitar múltiplas propostas ativas
-- Permite apenas uma proposta PENDING ou ACCEPTED por motorista por frete
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_unique_active_proposal 
ON freight_proposals (freight_id, driver_id) 
WHERE status IN ('PENDING', 'ACCEPTED');

-- Comentário explicativo
COMMENT ON INDEX idx_unique_active_proposal IS 'Garante que um motorista só pode ter uma proposta ativa (PENDING ou ACCEPTED) por frete';