-- ==========================================
-- REGRAS DE UNICIDADE POR CPF/CNPJ E LIMITE DE VEÍCULOS
-- ==========================================

-- 1. Criar índice único composto para garantir um perfil por documento e role
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_document_role 
ON profiles(document, role) 
WHERE document IS NOT NULL 
  AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA');

-- 2. Função para validar limites de documentos e roles
CREATE OR REPLACE FUNCTION check_document_role_limit()
RETURNS TRIGGER AS $$
DECLARE
  existing_role_count INT;
  existing_motorista_count INT;
BEGIN
  -- Verificar se documento já tem perfil do mesmo tipo
  SELECT COUNT(*) INTO existing_role_count
  FROM profiles
  WHERE document = NEW.document 
    AND role = NEW.role
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_role_count > 0 THEN
    RAISE EXCEPTION 'Este CPF/CNPJ já possui um cadastro como %. Cada documento pode ter apenas um perfil de cada tipo.', NEW.role;
  END IF;
  
  -- Verificar se documento já tem MOTORISTA ou MOTORISTA_AFILIADO (não pode ter os dois)
  IF NEW.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO') THEN
    SELECT COUNT(*) INTO existing_motorista_count
    FROM profiles
    WHERE document = NEW.document 
      AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_motorista_count > 0 THEN
      RAISE EXCEPTION 'Este CPF/CNPJ já possui um cadastro como motorista. Não é possível ter motorista autônomo e afiliado ao mesmo tempo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar trigger para validar antes de inserir ou atualizar perfil
DROP TRIGGER IF EXISTS validate_document_role_before_insert ON profiles;
CREATE TRIGGER validate_document_role_before_insert
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION check_document_role_limit();

-- 4. Função para validar limite de veículos
CREATE OR REPLACE FUNCTION check_vehicle_limit()
RETURNS TRIGGER AS $$
DECLARE
  driver_type TEXT;
  vehicle_count INT;
  is_company_owner BOOLEAN;
BEGIN
  -- Buscar tipo do motorista
  SELECT role INTO driver_type
  FROM profiles
  WHERE id = NEW.driver_id;
  
  -- Verificar se é dono de transportadora
  SELECT EXISTS(
    SELECT 1 FROM transport_companies
    WHERE profile_id = NEW.driver_id
  ) INTO is_company_owner;
  
  -- Se for motorista afiliado, não pode cadastrar veículos próprios
  IF driver_type = 'MOTORISTA_AFILIADO' THEN
    RAISE EXCEPTION 'Motoristas afiliados não podem cadastrar veículos próprios. Use os veículos da transportadora.';
  END IF;
  
  -- Se for motorista autônomo (não dono de transportadora), limite de 1 veículo
  IF driver_type = 'MOTORISTA' AND NOT is_company_owner THEN
    SELECT COUNT(*) INTO vehicle_count
    FROM vehicles
    WHERE driver_id = NEW.driver_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (company_id IS NULL OR company_id = NEW.company_id);
    
    IF vehicle_count >= 1 THEN
      RAISE EXCEPTION 'Motoristas autônomos podem cadastrar apenas 1 veículo. Para cadastrar mais veículos, transforme sua conta em transportadora.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Criar trigger para validar limite de veículos
DROP TRIGGER IF EXISTS validate_vehicle_limit_before_insert ON vehicles;
CREATE TRIGGER validate_vehicle_limit_before_insert
BEFORE INSERT OR UPDATE ON vehicles
FOR EACH ROW
EXECUTE FUNCTION check_vehicle_limit();