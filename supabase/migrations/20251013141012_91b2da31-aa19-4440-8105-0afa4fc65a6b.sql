-- ============================================================================
-- FASE 1: ESTRUTURA DE DADOS E HIERARQUIA
-- ============================================================================

-- 1.1 Adicionar TRANSPORTADORA ao enum user_role
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'TRANSPORTADORA';

-- 1.2 Tabela: transport_companies
CREATE TABLE IF NOT EXISTS public.transport_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Dados da empresa
  company_name TEXT NOT NULL,
  company_cnpj TEXT NOT NULL UNIQUE,
  state_registration TEXT,
  municipal_registration TEXT,
  
  -- Endereço
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Documentação
  cnpj_document_url TEXT,
  antt_registration TEXT,
  antt_document_url TEXT,
  
  -- Status e metadata
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  validation_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  
  -- Controle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transport_companies_profile ON transport_companies(profile_id);
CREATE INDEX IF NOT EXISTS idx_transport_companies_status ON transport_companies(status);

ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transportadoras podem ver seus próprios dados"
ON transport_companies FOR SELECT
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Transportadoras podem atualizar seus dados"
ON transport_companies FOR UPDATE
TO authenticated
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Transportadoras podem criar seus dados"
ON transport_companies FOR INSERT
TO authenticated
WITH CHECK (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins podem ver todas transportadoras"
ON transport_companies FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 1.3 Tabela: company_drivers (Hierarquia)
CREATE TABLE IF NOT EXISTS public.company_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  company_id UUID REFERENCES public.transport_companies(id) ON DELETE CASCADE NOT NULL,
  driver_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Convite
  invited_by UUID REFERENCES public.profiles(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  
  -- Permissões
  can_manage_vehicles BOOLEAN DEFAULT false,
  can_accept_freights BOOLEAN DEFAULT false,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id, driver_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_company_drivers_company ON company_drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_drivers_driver ON company_drivers(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_company_drivers_status ON company_drivers(status);

ALTER TABLE company_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transportadoras veem seus motoristas"
ON company_drivers FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR 
  driver_profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Transportadoras gerenciam motoristas"
ON company_drivers FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- 1.4 Função para gerar código único
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
BEGIN
  RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.5 Tabela: company_invites
CREATE TABLE IF NOT EXISTS public.company_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  company_id UUID REFERENCES public.transport_companies(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES public.profiles(id) NOT NULL,
  
  -- Dados do convite
  invite_code TEXT UNIQUE NOT NULL DEFAULT generate_invite_code(),
  invite_type TEXT NOT NULL CHECK (invite_type IN ('EMAIL', 'LINK', 'CODE')),
  
  -- Email (se tipo = EMAIL)
  invited_email TEXT,
  
  -- Status
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED')),
  
  -- Resposta
  accepted_by UUID REFERENCES public.profiles(id),
  accepted_at TIMESTAMPTZ,
  
  -- Expiração
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  
  -- Controle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_invites_company ON company_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_company_invites_code ON company_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_company_invites_status ON company_invites(status);

ALTER TABLE company_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transportadoras veem seus convites"
ON company_invites FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Usuários podem aceitar convites"
ON company_invites FOR SELECT
TO authenticated
USING (
  status = 'PENDING' AND expires_at > now()
);

-- ============================================================================
-- FASE 2: GESTÃO DE FROTA (CARRETAS)
-- ============================================================================

-- 2.1 Atualizar Tabela vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.transport_companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_company_vehicle BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_driver ON vehicles(assigned_driver_id);

-- Atualizar RLS policies de vehicles
DROP POLICY IF EXISTS "Drivers can manage their own vehicles" ON vehicles;
DROP POLICY IF EXISTS "Drivers can view their own vehicles" ON vehicles;

CREATE POLICY "Drivers e Transportadoras podem ver veículos"
ON vehicles FOR SELECT
TO authenticated
USING (
  driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  assigned_driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR
  is_admin()
);

CREATE POLICY "Transportadoras e Motoristas podem gerenciar veículos"
ON vehicles FOR ALL
TO authenticated
USING (
  driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- FASE 3: GESTÃO DE FRETES COM MÚLTIPLOS MOTORISTAS
-- ============================================================================

-- 3.1 Atualizar Tabela freights
ALTER TABLE public.freights
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.transport_companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accepted_by_company BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS required_trucks INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS accepted_trucks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS drivers_assigned UUID[] DEFAULT ARRAY[]::UUID[];

CREATE INDEX IF NOT EXISTS idx_freights_company ON freights(company_id);

-- Atualizar RLS para incluir transportadoras
CREATE POLICY "Transportadoras veem fretes aceitos"
ON freights FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR
  producer_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  id IN (
    SELECT freight_id FROM freight_assignments 
    WHERE driver_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- 3.2 Expandir Tabela freight_assignments
ALTER TABLE public.freight_assignments
ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.transport_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_freight_assignments_vehicle ON freight_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_freight_assignments_company ON freight_assignments(company_id);

-- ============================================================================
-- FASE 4: SISTEMA DE CHAT EM GRUPO
-- ============================================================================

-- 4.1 Tabela: freight_chat_participants
CREATE TABLE IF NOT EXISTS public.freight_chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID REFERENCES public.freights(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Tipo de participante
  participant_type TEXT NOT NULL CHECK (
    participant_type IN ('PRODUCER', 'COMPANY', 'DRIVER')
  ),
  
  -- Metadata
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(freight_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_freight ON freight_chat_participants(freight_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_profile ON freight_chat_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_active ON freight_chat_participants(freight_id, is_active);

ALTER TABLE freight_chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes veem outros participantes"
ON freight_chat_participants FOR SELECT
TO authenticated
USING (
  freight_id IN (
    SELECT freight_id FROM freight_chat_participants 
    WHERE participant_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND is_active = true
  )
);

CREATE POLICY "Sistema gerencia participantes"
ON freight_chat_participants FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4.2 Atualizar Tabela freight_messages
ALTER TABLE public.freight_messages
ADD COLUMN IF NOT EXISTS target_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS target_driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_location_request BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS request_responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_freight_messages_target_vehicle ON freight_messages(target_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_freight_messages_location_request ON freight_messages(freight_id, is_location_request);

-- Atualizar RLS para chat em grupo
DROP POLICY IF EXISTS "Users can view messages for their freights" ON freight_messages;
DROP POLICY IF EXISTS "Users can send messages for their freights" ON freight_messages;

CREATE POLICY "Participantes do chat veem mensagens"
ON freight_messages FOR SELECT
TO authenticated
USING (
  freight_id IN (
    SELECT freight_id FROM freight_chat_participants 
    WHERE participant_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND is_active = true
  )
);

CREATE POLICY "Participantes podem enviar mensagens"
ON freight_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND
  freight_id IN (
    SELECT freight_id FROM freight_chat_participants 
    WHERE participant_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND is_active = true
  )
);

-- 4.3 Tabela: company_internal_messages
CREATE TABLE IF NOT EXISTS public.company_internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  company_id UUID REFERENCES public.transport_companies(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) NOT NULL,
  
  -- Conteúdo
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'LOCATION', 'SYSTEM')),
  image_url TEXT,
  
  -- Localização
  location_lat NUMERIC,
  location_lng NUMERIC,
  location_address TEXT,
  
  -- Controle
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_company_messages_company ON company_internal_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_company_messages_sender ON company_internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_company_messages_created ON company_internal_messages(created_at DESC);

ALTER TABLE company_internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da transportadora veem mensagens internas"
ON company_internal_messages FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR
  sender_id IN (
    SELECT driver_profile_id FROM company_drivers 
    WHERE company_id = company_internal_messages.company_id
    AND status = 'ACTIVE'
    AND driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Membros podem enviar mensagens internas"
ON company_internal_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND
  (
    company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
    OR
    sender_id IN (
      SELECT driver_profile_id FROM company_drivers 
      WHERE company_id = company_internal_messages.company_id
      AND status = 'ACTIVE'
    )
  )
);

-- ============================================================================
-- FASE 5: FUNÇÕES E TRIGGERS
-- ============================================================================

-- 5.1 Função: Adicionar Participantes ao Chat Automaticamente
CREATE OR REPLACE FUNCTION add_freight_chat_participants()
RETURNS TRIGGER AS $$
BEGIN
  -- Adicionar produtor
  INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
  VALUES (NEW.id, NEW.producer_id, 'PRODUCER')
  ON CONFLICT (freight_id, participant_id) DO NOTHING;
  
  -- Adicionar transportadora se existir
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    SELECT NEW.id, tc.profile_id, 'COMPANY'
    FROM transport_companies tc
    WHERE tc.id = NEW.company_id
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  -- Adicionar motorista direto se existir
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    VALUES (NEW.id, NEW.driver_id, 'DRIVER')
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_add_freight_chat_participants ON freights;
CREATE TRIGGER trigger_add_freight_chat_participants
AFTER INSERT OR UPDATE OF driver_id, company_id ON freights
FOR EACH ROW
EXECUTE FUNCTION add_freight_chat_participants();

-- 5.2 Função: Adicionar Motoristas Assigned ao Chat
CREATE OR REPLACE FUNCTION add_assigned_driver_to_chat()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
  VALUES (NEW.freight_id, NEW.driver_id, 'DRIVER')
  ON CONFLICT (freight_id, participant_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_add_assigned_driver_to_chat ON freight_assignments;
CREATE TRIGGER trigger_add_assigned_driver_to_chat
AFTER INSERT ON freight_assignments
FOR EACH ROW
EXECUTE FUNCTION add_assigned_driver_to_chat();

-- 5.3 Função: Sincronizar Accepted Trucks
CREATE OR REPLACE FUNCTION sync_accepted_trucks()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE freights
  SET 
    accepted_trucks = (
      SELECT COUNT(*) 
      FROM freight_assignments 
      WHERE freight_id = COALESCE(NEW.freight_id, OLD.freight_id)
      AND status = 'ACCEPTED'
    ),
    drivers_assigned = (
      SELECT array_agg(DISTINCT driver_id) 
      FROM freight_assignments 
      WHERE freight_id = COALESCE(NEW.freight_id, OLD.freight_id)
      AND status = 'ACCEPTED'
    )
  WHERE id = COALESCE(NEW.freight_id, OLD.freight_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_accepted_trucks ON freight_assignments;
CREATE TRIGGER trigger_sync_accepted_trucks
AFTER INSERT OR UPDATE OR DELETE ON freight_assignments
FOR EACH ROW
EXECUTE FUNCTION sync_accepted_trucks();

-- 5.4 Função: Verificar se usuário é transportadora
CREATE OR REPLACE FUNCTION is_transport_company(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE p.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5.5 Função: Verificar se usuário é motorista de uma transportadora
CREATE OR REPLACE FUNCTION is_company_driver(p_user_id UUID, p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_drivers cd
    JOIN profiles p ON cd.driver_profile_id = p.id
    WHERE p.user_id = p_user_id
    AND cd.company_id = p_company_id
    AND cd.status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5.6 Trigger para auditar convites
CREATE OR REPLACE FUNCTION audit_company_invites()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, table_name, operation, new_data)
    VALUES (auth.uid(), 'company_invites', 'INVITE_CREATED', row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO audit_logs (user_id, table_name, operation, old_data, new_data)
    VALUES (auth.uid(), 'company_invites', 'INVITE_STATUS_CHANGED', 
            row_to_json(OLD), row_to_json(NEW));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_company_invites ON company_invites;
CREATE TRIGGER trigger_audit_company_invites
AFTER INSERT OR UPDATE ON company_invites
FOR EACH ROW
EXECUTE FUNCTION audit_company_invites();