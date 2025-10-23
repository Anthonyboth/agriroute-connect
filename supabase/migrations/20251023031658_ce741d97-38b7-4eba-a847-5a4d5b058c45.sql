-- FASE 3: Criar tabela affiliated_drivers_tracking
CREATE TABLE affiliated_drivers_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES transport_companies(id) ON DELETE CASCADE,
  current_freight_id UUID REFERENCES freights(id) ON DELETE SET NULL,
  is_available BOOLEAN DEFAULT TRUE,
  last_gps_update TIMESTAMPTZ,
  current_lat NUMERIC,
  current_lng NUMERIC,
  tracking_status TEXT CHECK (tracking_status IN ('IDLE', 'IN_TRANSIT', 'LOADING', 'UNLOADING')),
  can_accept_autonomous_freights BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(driver_profile_id, company_id)
);

-- Índices para performance
CREATE INDEX idx_affiliated_tracking_driver ON affiliated_drivers_tracking(driver_profile_id);
CREATE INDEX idx_affiliated_tracking_company ON affiliated_drivers_tracking(company_id);
CREATE INDEX idx_affiliated_tracking_available ON affiliated_drivers_tracking(is_available) WHERE is_available = TRUE;
CREATE INDEX idx_affiliated_tracking_freight ON affiliated_drivers_tracking(current_freight_id) WHERE current_freight_id IS NOT NULL;

-- RLS Policies
ALTER TABLE affiliated_drivers_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can see their drivers tracking"
  ON affiliated_drivers_tracking FOR SELECT
  USING (
    company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Drivers can see their own tracking"
  ON affiliated_drivers_tracking FOR SELECT
  USING (
    driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can update tracking"
  ON affiliated_drivers_tracking FOR UPDATE
  USING (
    driver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    company_id IN (SELECT id FROM transport_companies WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "System can insert tracking"
  ON affiliated_drivers_tracking FOR INSERT
  WITH CHECK (
    driver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR
    company_id IN (SELECT id FROM transport_companies WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

-- FASE 4: Regra "1 Frete Por Vez" - Funções e Triggers

-- Função para validar que motorista não tem outro frete ativo
CREATE OR REPLACE FUNCTION check_driver_availability()
RETURNS TRIGGER AS $$
DECLARE
  active_freight_count INTEGER;
  driver_role TEXT;
BEGIN
  -- Se não tem driver_id, permitir (frete aberto)
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar role do motorista
  SELECT role INTO driver_role
  FROM profiles
  WHERE id = NEW.driver_id;
  
  -- Se for motorista afiliado, verificar se já tem frete ativo
  IF driver_role IN ('MOTORISTA_AFILIADO', 'MOTORISTA') OR 
     EXISTS (SELECT 1 FROM company_drivers WHERE driver_profile_id = NEW.driver_id AND status = 'ACTIVE') 
  THEN
    -- Contar fretes ativos para este motorista
    SELECT COUNT(*) INTO active_freight_count
    FROM freights
    WHERE driver_id = NEW.driver_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF active_freight_count > 0 THEN
      RAISE EXCEPTION 'Motorista já possui um frete em andamento. Complete o frete atual antes de aceitar outro.';
    END IF;
  END IF;
  
  -- Atualizar tracking de disponibilidade (se existir registro)
  UPDATE affiliated_drivers_tracking
  SET is_available = FALSE,
      current_freight_id = NEW.id,
      tracking_status = CASE 
        WHEN NEW.status = 'LOADING' THEN 'LOADING'
        WHEN NEW.status = 'LOADED' THEN 'LOADING'
        ELSE 'IN_TRANSIT'
      END,
      updated_at = NOW()
  WHERE driver_profile_id = NEW.driver_id
  AND EXISTS (SELECT 1 FROM affiliated_drivers_tracking WHERE driver_profile_id = NEW.driver_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger ao aceitar/atualizar frete
DROP TRIGGER IF EXISTS enforce_one_freight_per_driver ON freights;
CREATE TRIGGER enforce_one_freight_per_driver
  BEFORE INSERT OR UPDATE OF driver_id, status ON freights
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL AND NEW.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'))
  EXECUTE FUNCTION check_driver_availability();

-- Função para liberar motorista quando frete finaliza
CREATE OR REPLACE FUNCTION release_driver_on_freight_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('DELIVERED', 'CANCELLED') AND OLD.status NOT IN ('DELIVERED', 'CANCELLED') THEN
    UPDATE affiliated_drivers_tracking
    SET is_available = TRUE,
        current_freight_id = NULL,
        tracking_status = 'IDLE',
        updated_at = NOW()
    WHERE driver_profile_id = NEW.driver_id
    AND EXISTS (SELECT 1 FROM affiliated_drivers_tracking WHERE driver_profile_id = NEW.driver_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS release_driver_trigger ON freights;
CREATE TRIGGER release_driver_trigger
  AFTER UPDATE OF status ON freights
  FOR EACH ROW
  EXECUTE FUNCTION release_driver_on_freight_completion();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_affiliated_tracking_updated_at
  BEFORE UPDATE ON affiliated_drivers_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Popular tabela com motoristas afiliados existentes
INSERT INTO affiliated_drivers_tracking (driver_profile_id, company_id, is_available, tracking_status)
SELECT 
  cd.driver_profile_id,
  cd.company_id,
  NOT EXISTS (
    SELECT 1 FROM freights f 
    WHERE f.driver_id = cd.driver_profile_id 
    AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  ) as is_available,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM freights f 
      WHERE f.driver_id = cd.driver_profile_id 
      AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
    ) THEN 'IN_TRANSIT'
    ELSE 'IDLE'
  END as tracking_status
FROM company_drivers cd
WHERE cd.status = 'ACTIVE'
ON CONFLICT (driver_profile_id, company_id) DO NOTHING;