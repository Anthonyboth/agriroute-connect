-- Remove constraint antiga que não permite IN_TRANSIT, DELAY e REST_STOP
ALTER TABLE freight_checkins 
DROP CONSTRAINT IF EXISTS freight_checkins_checkin_type_check;

-- Adiciona constraint nova com TODOS os tipos usados no frontend
ALTER TABLE freight_checkins
ADD CONSTRAINT freight_checkins_checkin_type_check
CHECK (checkin_type IN (
  'LOADING',
  'UNLOADING',
  'ROUTE_UPDATE',
  'INCIDENT',
  'IN_TRANSIT',
  'DELAY',
  'REST_STOP'
));

COMMENT ON CONSTRAINT freight_checkins_checkin_type_check ON freight_checkins IS 
'Constraint atualizada para incluir todos os tipos de check-in: LOADING, UNLOADING, ROUTE_UPDATE, INCIDENT, IN_TRANSIT, DELAY, REST_STOP';

-- Normalizar tipos inválidos existentes (se houver)
UPDATE freight_checkins
SET checkin_type = 'ROUTE_UPDATE'
WHERE checkin_type NOT IN ('LOADING', 'UNLOADING', 'ROUTE_UPDATE', 'INCIDENT', 'IN_TRANSIT', 'DELAY', 'REST_STOP');