-- =====================================================
-- SISTEMA DE MÚLTIPLAS CARRETAS COM VALORES INDIVIDUALIZADOS
-- =====================================================

-- 1. Criar tabela freight_assignments
CREATE TABLE IF NOT EXISTS freight_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES freight_proposals(id) ON DELETE SET NULL,
  
  -- Valor acordado individualmente
  agreed_price NUMERIC NOT NULL CHECK (agreed_price > 0),
  price_per_km NUMERIC CHECK (price_per_km > 0),
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('FIXED', 'PER_KM')),
  
  -- Validação ANTT no momento da aceitação
  minimum_antt_price NUMERIC,
  antt_details JSONB,
  
  -- Status da execução do frete por este motorista
  status TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (status IN (
    'ACCEPTED',
    'IN_TRANSIT',
    'DELIVERED_PENDING_CONFIRMATION',
    'DELIVERED',
    'CANCELLED'
  )),
  
  -- Datas importantes
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  pickup_date DATE,
  delivery_date DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadados
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Garantir que motorista não aceite duas vezes o mesmo frete
  UNIQUE(freight_id, driver_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_freight_assignments_freight ON freight_assignments(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_assignments_driver ON freight_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_freight_assignments_status ON freight_assignments(status);

-- 2. Modificar tabela freights para suportar múltiplos drivers
ALTER TABLE freights
  ADD COLUMN IF NOT EXISTS is_full_booking BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS drivers_assigned UUID[] DEFAULT ARRAY[]::UUID[];

-- Atualizar constraint de accepted_trucks
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'freights_accepted_trucks_check'
  ) THEN
    ALTER TABLE freights DROP CONSTRAINT freights_accepted_trucks_check;
  END IF;
END $$;

ALTER TABLE freights
  ADD CONSTRAINT freights_accepted_trucks_within_required 
  CHECK (accepted_trucks >= 0 AND accepted_trucks <= required_trucks);

-- 3. RLS Policies para freight_assignments
ALTER TABLE freight_assignments ENABLE ROW LEVEL SECURITY;

-- Motoristas veem suas próprias atribuições, produtores veem suas contratações
CREATE POLICY "Drivers and producers can view assignments"
ON freight_assignments FOR SELECT
USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  freight_id IN (
    SELECT id FROM freights WHERE producer_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR
  is_admin()
);

-- Apenas sistema pode criar assignments (via edge function)
CREATE POLICY "System can create assignments"
ON freight_assignments FOR INSERT
WITH CHECK (true);

-- Motorista pode atualizar status do seu assignment
CREATE POLICY "Drivers can update their assignment status"
ON freight_assignments FOR UPDATE
USING (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins podem deletar
CREATE POLICY "Admins can delete assignments"
ON freight_assignments FOR DELETE
USING (is_admin());

-- 4. Trigger para updated_at
CREATE TRIGGER update_freight_assignments_updated_at
BEFORE UPDATE ON freight_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Remover triggers e funções antigas do sistema de propostas
DROP TRIGGER IF EXISTS update_accepted_trucks_count ON freight_proposals;
DROP TRIGGER IF EXISTS update_trucks_count_trigger ON freight_proposals;
DROP FUNCTION IF EXISTS update_accepted_trucks_count() CASCADE;

-- 6. Novo trigger baseado em freight_assignments
CREATE OR REPLACE FUNCTION sync_freight_accepted_trucks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar contador de carretas aceitas
  IF TG_OP = 'INSERT' THEN
    UPDATE freights 
    SET 
      accepted_trucks = accepted_trucks + 1,
      drivers_assigned = array_append(drivers_assigned, NEW.driver_id),
      is_full_booking = (accepted_trucks + 1) >= required_trucks,
      status = CASE 
        WHEN (accepted_trucks + 1) >= required_trucks THEN 'IN_NEGOTIATION'::freight_status
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.freight_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE freights 
    SET 
      accepted_trucks = GREATEST(0, accepted_trucks - 1),
      drivers_assigned = array_remove(drivers_assigned, OLD.driver_id),
      is_full_booking = (accepted_trucks - 1) >= required_trucks,
      status = CASE 
        WHEN (accepted_trucks - 1) < required_trucks THEN 'OPEN'::freight_status
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = OLD.freight_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_freight_trucks_on_assignment
AFTER INSERT OR DELETE ON freight_assignments
FOR EACH ROW
EXECUTE FUNCTION sync_freight_accepted_trucks();