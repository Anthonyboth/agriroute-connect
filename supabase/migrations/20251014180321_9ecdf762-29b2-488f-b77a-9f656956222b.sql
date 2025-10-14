-- FASE 1: Corrigir dados inconsistentes
-- Atualizar perfil para TRANSPORTADORA pois já tem empresa cadastrada
UPDATE profiles 
SET role = 'TRANSPORTADORA', 
    active_mode = 'TRANSPORTADORA' 
WHERE id = '731a4cee-b9de-426e-a0ab-acb7b70ff7a0';

-- FASE 4: Criar função e trigger para validação automática
CREATE OR REPLACE FUNCTION validate_transport_company_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está inserindo uma transportadora
  IF TG_OP = 'INSERT' THEN
    -- Verificar se o profile tem role apropriado
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = NEW.profile_id 
      AND role NOT IN ('MOTORISTA', 'PRODUTOR', 'TRANSPORTADORA')
    ) THEN
      RAISE EXCEPTION 'Perfil não pode criar transportadora com este tipo de conta';
    END IF;
    
    -- Atualizar role para TRANSPORTADORA automaticamente
    UPDATE profiles 
    SET role = 'TRANSPORTADORA',
        active_mode = 'TRANSPORTADORA'
    WHERE id = NEW.profile_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger que valida antes de inserir transportadora
CREATE TRIGGER ensure_transport_company_role
  BEFORE INSERT ON transport_companies
  FOR EACH ROW
  EXECUTE FUNCTION validate_transport_company_profile();