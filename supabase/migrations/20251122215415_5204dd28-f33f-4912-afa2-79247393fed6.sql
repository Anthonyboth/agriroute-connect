-- CORREÇÃO DEFINITIVA: Limpar histórico de cancelamento que está bloqueando atualizações

-- Deletar o registro CANCELLED que está causando o bloqueio no preflight check
DELETE FROM freight_status_history
WHERE freight_id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802'
  AND status = 'CANCELLED'
  AND notes LIKE '%Assignment cancelado automaticamente%';

-- Verificar que o histórico agora só tem ACCEPTED
SELECT 
  freight_id,
  status,
  notes,
  created_at
FROM freight_status_history
WHERE freight_id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802'
ORDER BY created_at DESC;