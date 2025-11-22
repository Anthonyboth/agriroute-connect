
-- Corrigir o freight assignment travado com estrutura correta
UPDATE freight_assignments
SET 
  status = 'CANCELLED',
  updated_at = now()
WHERE id = '11684b35-09aa-45bc-bf30-a990874e253e';

-- Adicionar entrada no histórico com nome correto da coluna
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
  'Assignment cancelado automaticamente devido a estado travado (LOADING por 11+ dias)',
  now()
FROM freight_assignments
WHERE id = '11684b35-09aa-45bc-bf30-a990874e253e';
