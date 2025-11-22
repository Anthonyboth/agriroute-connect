-- REVERSÃO URGENTE: Restaurar frete aceito hoje que foi cancelado por engano

-- 1. Restaurar o status do FRETE para ACCEPTED
UPDATE freights
SET 
  status = 'ACCEPTED',
  cancelled_at = NULL,
  cancellation_reason = NULL,
  updated_at = now()
WHERE id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802';

-- 2. Restaurar o status do ASSIGNMENT para ACCEPTED
UPDATE freight_assignments
SET 
  status = 'ACCEPTED',
  updated_at = now()
WHERE freight_id = '57c16fbf-ed6c-47cf-bc1a-e2e13531f802'
  AND driver_id = 'd93be6b4-180a-49ed-84d0-f5e220e35190';

-- 3. Registrar a correção no histórico
INSERT INTO freight_status_history (
  freight_id,
  status,
  changed_by,
  notes,
  created_at
)
VALUES (
  '57c16fbf-ed6c-47cf-bc1a-e2e13531f802',
  'ACCEPTED',
  'd93be6b4-180a-49ed-84d0-f5e220e35190',
  'Frete restaurado - cancelamento incorreto revertido (frete aceito hoje às 21:24)',
  now()
);