-- Migration: Auto-approve company vehicles
-- Criar função para auto-aprovar veículos de transportadoras
CREATE OR REPLACE FUNCTION auto_approve_company_vehicles()
RETURNS TRIGGER AS $$
BEGIN
  -- Se é veículo de transportadora, aprovar automaticamente
  IF NEW.is_company_vehicle = true THEN
    NEW.status := 'APPROVED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger se existir
DROP TRIGGER IF EXISTS trigger_auto_approve_company_vehicles ON vehicles;

-- Criar trigger
CREATE TRIGGER trigger_auto_approve_company_vehicles
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_company_vehicles();

COMMENT ON FUNCTION auto_approve_company_vehicles() IS 'Aprova automaticamente veículos cadastrados por transportadoras';

-- Aprovar todos os veículos de transportadoras que estão pendentes
UPDATE vehicles
SET 
  status = 'APPROVED',
  updated_at = NOW()
WHERE is_company_vehicle = true 
  AND status = 'PENDING'
  AND company_id IS NOT NULL;