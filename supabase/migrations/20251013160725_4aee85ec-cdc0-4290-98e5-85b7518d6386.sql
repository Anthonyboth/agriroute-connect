-- ETAPA 1.1: Adicionar controle de modo ativo
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS active_mode TEXT DEFAULT 'MOTORISTA' 
CHECK (active_mode IN ('MOTORISTA', 'TRANSPORTADORA'));

-- Adicionar índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_active_mode ON profiles(user_id, active_mode);

-- ETAPA 1.2: Melhorar sistema de convites
ALTER TABLE company_invites
ADD COLUMN IF NOT EXISTS invited_driver_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS registration_data JSONB;

-- Criar view para links de convite
CREATE OR REPLACE VIEW company_invite_links AS
SELECT 
  ci.id,
  ci.company_id,
  ci.invite_code,
  ci.invite_type,
  ci.invited_email,
  tc.company_name,
  CONCAT('https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com/company-invite/', ci.invite_code) AS invite_link
FROM company_invites ci
JOIN transport_companies tc ON ci.company_id = tc.id
WHERE ci.status = 'PENDING' AND ci.expires_at > NOW();

-- ETAPA 1.3: Melhorar vinculação de veículos
CREATE OR REPLACE FUNCTION validate_vehicle_driver_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_company_vehicle = TRUE AND NEW.assigned_driver_id IS NOT NULL THEN
    -- Verificar se o motorista está afiliado à transportadora
    IF NOT EXISTS (
      SELECT 1 FROM company_drivers cd
      WHERE cd.company_id = NEW.company_id
      AND cd.driver_profile_id = NEW.assigned_driver_id
      AND cd.status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'Motorista não está afiliado a esta transportadora';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_vehicle_driver_assignment ON vehicles;
CREATE TRIGGER check_vehicle_driver_assignment
BEFORE INSERT OR UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION validate_vehicle_driver_assignment();

-- ETAPA 1.4: Melhorar tabela de participantes do chat
CREATE OR REPLACE FUNCTION add_company_to_freight_chat()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o frete foi atribuído a uma transportadora
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    SELECT NEW.id, tc.profile_id, 'COMPANY'
    FROM transport_companies tc
    WHERE tc.id = NEW.company_id
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_company_chat_participant ON freights;
CREATE TRIGGER add_company_chat_participant
AFTER INSERT OR UPDATE OF company_id ON freights
FOR EACH ROW EXECUTE FUNCTION add_company_to_freight_chat();