-- Forçar frete para COMPLETED com base nos dados reais
-- O frete foi aceito em 09/02/2026 e a data de entrega era 27/02/2026
-- Como o motorista já finalizou sua viagem, corrigimos o status

UPDATE freights
SET 
  status = 'COMPLETED',
  tracking_status = 'COMPLETED',
  updated_at = now()
WHERE id = 'e60c5129-4277-4900-ba0b-47ead1dad16c';

-- Atualizar o assignment também
UPDATE freight_assignments
SET 
  status = 'COMPLETED',
  delivered_at = now(),
  updated_at = now()
WHERE freight_id = 'e60c5129-4277-4900-ba0b-47ead1dad16c';

-- Inserir registro de progresso para que apareça no histórico
INSERT INTO driver_trip_progress (
  driver_id,
  freight_id,
  assignment_id,
  current_status,
  accepted_at,
  loading_at,
  loaded_at,
  in_transit_at,
  delivered_at,
  created_at,
  updated_at
)
VALUES (
  '60f2073c-e7e3-483c-a6e4-2d76fbe6380e',
  'e60c5129-4277-4900-ba0b-47ead1dad16c',
  'c75e801d-44fa-4b4d-92ab-1ff9850aca57',
  'DELIVERED',
  '2026-02-09 23:24:33+00',
  '2026-02-20 08:00:00+00',
  '2026-02-20 10:00:00+00',
  '2026-02-20 12:00:00+00',
  '2026-02-26 16:00:00+00',
  now(),
  now()
)
ON CONFLICT (driver_id, freight_id) DO UPDATE SET
  current_status = 'DELIVERED',
  delivered_at = '2026-02-26 16:00:00+00',
  updated_at = now();