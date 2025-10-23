-- Add missing columns to vehicles table for document and photo storage
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS vehicle_documents jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS vehicle_photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS vehicle_specifications text;

COMMENT ON COLUMN vehicles.vehicle_documents IS 'Array JSON de URLs de documentos adicionais do veículo';
COMMENT ON COLUMN vehicles.vehicle_photos IS 'Array JSON de URLs de fotos do veículo';
COMMENT ON COLUMN vehicles.vehicle_specifications IS 'Especificações técnicas do veículo em texto';