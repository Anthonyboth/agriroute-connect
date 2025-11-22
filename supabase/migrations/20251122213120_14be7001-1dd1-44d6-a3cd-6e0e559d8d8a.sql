-- Cancelar o segundo freight assignment travado (frete recém-aceito que está bloqueando novos aceites)
UPDATE freight_assignments
SET 
  status = 'CANCELLED',
  updated_at = now()
WHERE freight_id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802';

-- Registrar no histórico
INSERT INTO freight_status_history (
  freight_id,
  status,
  changed_by,
  notes,
  created_at
)
SELECT 
  freight_id,
  'CANCELLED',
  driver_id,
  'Assignment cancelado automaticamente - correção de múltiplos assignments travados',
  now()
FROM freight_assignments
WHERE freight_id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802'
LIMIT 1;

-- Atualizar o frete em si para CANCELLED
UPDATE freights
SET 
  status = 'CANCELLED',
  cancelled_at = now(),
  cancellation_reason = 'Cancelamento automático - correção de assignment travado',
  updated_at = now()
WHERE id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802';