-- Migration: Conditional Vehicle Approval Based on Driver Type
-- Dropar trigger antigo
DROP TRIGGER IF EXISTS trigger_auto_approve_company_vehicles ON vehicles;
DROP FUNCTION IF EXISTS auto_approve_company_vehicles();

-- Criar nova função com lógica condicional
CREATE OR REPLACE FUNCTION conditional_vehicle_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_is_affiliated BOOLEAN;
  v_company_id UUID;
BEGIN
  -- Caso 1: Veículo de transportadora → Aprovar automaticamente
  IF NEW.is_company_vehicle = true THEN
    NEW.status := 'APPROVED';
    RETURN NEW;
  END IF;

  -- Caso 2: Verificar se motorista é AFILIADO a alguma transportadora
  SELECT 
    EXISTS(
      SELECT 1 
      FROM company_drivers 
      WHERE driver_profile_id = NEW.driver_id 
        AND affiliation_type = 'AFFILIATED'
        AND status = 'ACTIVE'
    ),
    company_id
  INTO v_is_affiliated, v_company_id
  FROM company_drivers
  WHERE driver_profile_id = NEW.driver_id 
    AND affiliation_type = 'AFFILIATED'
    AND status = 'ACTIVE'
  LIMIT 1;

  -- Se é motorista AFILIADO cadastrando veículo próprio → Requer aprovação
  IF v_is_affiliated = true THEN
    NEW.status := 'PENDING';
    NEW.company_id := v_company_id; -- Associar à transportadora para aprovação
    RETURN NEW;
  END IF;

  -- Caso 3: Motorista autônomo → Aprovar automaticamente
  NEW.status := 'APPROVED';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar novo trigger
CREATE TRIGGER trigger_conditional_vehicle_approval
  BEFORE INSERT ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION conditional_vehicle_approval();

COMMENT ON FUNCTION conditional_vehicle_approval() IS 
  'Aprova automaticamente veículos de transportadoras e motoristas autônomos. 
   Veículos de motoristas afiliados requerem aprovação do admin da transportadora.';