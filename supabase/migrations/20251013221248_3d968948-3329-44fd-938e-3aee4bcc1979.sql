-- Criar tabela de vínculos entre motoristas e veículos da transportadora
CREATE TABLE IF NOT EXISTS company_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES transport_companies(id) ON DELETE CASCADE NOT NULL,
  driver_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES profiles(id),
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_profile_id, vehicle_id, company_id)
);

-- Índices para performance
CREATE INDEX idx_company_vehicle_assignments_company ON company_vehicle_assignments(company_id);
CREATE INDEX idx_company_vehicle_assignments_driver ON company_vehicle_assignments(driver_profile_id);
CREATE INDEX idx_company_vehicle_assignments_vehicle ON company_vehicle_assignments(vehicle_id);
CREATE INDEX idx_company_vehicle_assignments_active ON company_vehicle_assignments(company_id, driver_profile_id) WHERE removed_at IS NULL;

-- Trigger para updated_at
CREATE TRIGGER update_company_vehicle_assignments_updated_at
  BEFORE UPDATE ON company_vehicle_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE company_vehicle_assignments ENABLE ROW LEVEL SECURITY;

-- Transportadoras gerenciam vínculos de seus motoristas
CREATE POLICY "company_manages_vehicle_assignments" ON company_vehicle_assignments
FOR ALL USING (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
) WITH CHECK (
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Motoristas veem seus próprios vínculos ativos
CREATE POLICY "drivers_view_own_vehicle_assignments" ON company_vehicle_assignments
FOR SELECT USING (
  driver_profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  AND removed_at IS NULL
);

-- Admins podem ver todos os vínculos
CREATE POLICY "admins_view_all_vehicle_assignments" ON company_vehicle_assignments
FOR SELECT USING (is_admin());

-- Função para garantir apenas um veículo principal por motorista
CREATE OR REPLACE FUNCTION validate_primary_vehicle_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true AND NEW.removed_at IS NULL THEN
    -- Remover flag primary de outros veículos do mesmo motorista na mesma empresa
    UPDATE company_vehicle_assignments
    SET is_primary = false,
        updated_at = NOW()
    WHERE driver_profile_id = NEW.driver_profile_id
      AND company_id = NEW.company_id
      AND id != NEW.id
      AND removed_at IS NULL
      AND is_primary = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER ensure_single_primary_vehicle
  BEFORE INSERT OR UPDATE ON company_vehicle_assignments
  FOR EACH ROW
  EXECUTE FUNCTION validate_primary_vehicle_assignment();

-- Audit log para vínculos
CREATE TRIGGER audit_company_vehicle_assignments
  AFTER INSERT OR UPDATE OR DELETE ON company_vehicle_assignments
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();