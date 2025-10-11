-- Remover constraint antiga de message_type
ALTER TABLE freight_messages 
DROP CONSTRAINT IF EXISTS freight_messages_message_type_check;

-- Adicionar nova constraint com tipos de localização
ALTER TABLE freight_messages 
ADD CONSTRAINT freight_messages_message_type_check 
CHECK (message_type IN ('TEXT', 'IMAGE', 'SYSTEM', 'LOCATION_REQUEST', 'LOCATION_RESPONSE'));

-- Adicionar campos de localização (nullable para não quebrar mensagens existentes)
ALTER TABLE freight_messages 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL;

ALTER TABLE freight_messages 
ADD COLUMN IF NOT EXISTS location_lng DECIMAL;

ALTER TABLE freight_messages 
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Criar índice para queries de localização
CREATE INDEX IF NOT EXISTS idx_freight_messages_location 
ON freight_messages(freight_id, message_type) 
WHERE message_type IN ('LOCATION_REQUEST', 'LOCATION_RESPONSE');