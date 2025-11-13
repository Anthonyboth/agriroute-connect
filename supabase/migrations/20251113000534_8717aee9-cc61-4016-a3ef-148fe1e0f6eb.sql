-- Migration: Trigger para garantir unicidade de veículo principal por motorista
-- Quando um vínculo é marcado como principal, desmarca todos os outros do mesmo motorista

CREATE OR REPLACE FUNCTION ensure_single_primary_vehicle()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o novo vínculo está sendo marcado como principal
  IF NEW.is_primary = true THEN
    -- Desmarcar todos os outros vínculos primários do mesmo motorista na mesma empresa
    UPDATE company_vehicle_assignments
    SET is_primary = false
    WHERE driver_profile_id = NEW.driver_profile_id
      AND company_id = NEW.company_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND removed_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger que executa ANTES de INSERT ou UPDATE
CREATE TRIGGER ensure_single_primary_vehicle_trigger
BEFORE INSERT OR UPDATE OF is_primary ON company_vehicle_assignments
FOR EACH ROW
EXECUTE FUNCTION ensure_single_primary_vehicle();

-- Adicionar comentário explicativo
COMMENT ON FUNCTION ensure_single_primary_vehicle() IS 'Garante que apenas um veículo seja marcado como principal por motorista em cada empresa';