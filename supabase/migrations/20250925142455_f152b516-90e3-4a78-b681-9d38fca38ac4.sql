-- Adicionar constraint única para evitar duplicatas na tabela freight_matches
-- Primeiro, remover duplicatas existentes se houver
DELETE FROM freight_matches a 
USING freight_matches b 
WHERE a.id > b.id 
  AND a.freight_id = b.freight_id 
  AND a.driver_id = b.driver_id;

-- Adicionar constraint única para freight_id + driver_id
ALTER TABLE freight_matches 
ADD CONSTRAINT freight_matches_freight_driver_unique 
UNIQUE (freight_id, driver_id);

-- Atualizar driver_notification_limits para este driver específico se necessário
INSERT INTO driver_notification_limits (driver_id, notification_count, max_notifications_per_hour, window_start)
VALUES ('5fd6a024-41af-47f4-8224-20d8ee82f860', 0, 5, now())
ON CONFLICT (driver_id) 
DO UPDATE SET 
  notification_count = 0,
  max_notifications_per_hour = 5,
  window_start = now();