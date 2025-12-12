-- Remover pagamentos duplicados (manter apenas o mais antigo de cada combinação)
-- Usando subquery com created_at para identificar duplicatas
DELETE FROM external_payments 
WHERE id IN (
  SELECT ep.id
  FROM external_payments ep
  WHERE EXISTS (
    SELECT 1 FROM external_payments ep2
    WHERE ep2.freight_id = ep.freight_id 
      AND ep2.producer_id = ep.producer_id 
      AND ep2.driver_id = ep.driver_id 
      AND ep2.status = ep.status
      AND ep2.created_at < ep.created_at
  )
);

-- Criar índice único parcial para evitar futuros duplicados em status 'proposed'
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_payments_unique_pending 
ON external_payments (freight_id, producer_id, driver_id) 
WHERE status = 'proposed';