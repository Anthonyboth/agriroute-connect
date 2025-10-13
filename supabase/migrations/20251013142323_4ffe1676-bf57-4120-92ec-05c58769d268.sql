-- PASSO 1: Desabilitar triggers temporariamente
ALTER TABLE freights DISABLE TRIGGER trigger_add_freight_chat_participants;
ALTER TABLE freight_assignments DISABLE TRIGGER trigger_add_assigned_driver_to_chat;
ALTER TABLE freight_assignments DISABLE TRIGGER trigger_sync_accepted_trucks;

-- PASSO 2: Popular freight_chat_participants com dados históricos

-- Adicionar produtores
INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
SELECT DISTINCT f.id, f.producer_id, 'PRODUCER'
FROM freights f
WHERE f.producer_id IS NOT NULL
ON CONFLICT (freight_id, participant_id) DO NOTHING;

-- Adicionar motoristas diretos
INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
SELECT DISTINCT f.id, f.driver_id, 'DRIVER'
FROM freights f
WHERE f.driver_id IS NOT NULL
ON CONFLICT (freight_id, participant_id) DO NOTHING;

-- Adicionar motoristas de assignments
INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
SELECT DISTINCT fa.freight_id, fa.driver_id, 'DRIVER'
FROM freight_assignments fa
WHERE fa.driver_id IS NOT NULL
ON CONFLICT (freight_id, participant_id) DO NOTHING;

-- Adicionar transportadoras
INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
SELECT DISTINCT f.id, tc.profile_id, 'COMPANY'
FROM freights f
JOIN transport_companies tc ON f.company_id = tc.id
WHERE f.company_id IS NOT NULL
ON CONFLICT (freight_id, participant_id) DO NOTHING;

-- PASSO 3: Adicionar fallback às policies RLS de freight_messages
DROP POLICY IF EXISTS "Participantes do chat veem mensagens" ON freight_messages;

CREATE POLICY "Participantes do chat veem mensagens"
ON freight_messages FOR SELECT
TO authenticated
USING (
  -- Nova lógica: participantes do chat
  freight_id IN (
    SELECT freight_id FROM freight_chat_participants 
    WHERE participant_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND is_active = true
  )
  OR
  -- FALLBACK: lógica antiga para fretes sem participantes
  (
    NOT EXISTS (
      SELECT 1 FROM freight_chat_participants 
      WHERE freight_id = freight_messages.freight_id
    )
    AND
    freight_id IN (
      SELECT id FROM freights
      WHERE producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR id IN (
        SELECT freight_id FROM freight_assignments 
        WHERE driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    )
  )
);

-- PASSO 4: Adicionar fallback às policies RLS de freights
DROP POLICY IF EXISTS "Motoristas veem seus fretes" ON freights;
DROP POLICY IF EXISTS "Produtores veem seus fretes" ON freights;
DROP POLICY IF EXISTS "Admins veem todos os fretes" ON freights;
DROP POLICY IF EXISTS "Transportadoras veem fretes aceitos" ON freights;

CREATE POLICY "Usuários veem seus fretes"
ON freights FOR SELECT
TO authenticated
USING (
  -- Produtor
  producer_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  -- Motorista direto
  driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
  OR
  -- Motorista via assignment
  id IN (
    SELECT freight_id FROM freight_assignments 
    WHERE driver_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR
  -- Transportadora
  company_id IN (
    SELECT id FROM transport_companies 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  OR
  -- Admin
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'ADMIN'
  )
);

-- PASSO 5: Modificar trigger sync_accepted_trucks para evitar recursão
CREATE OR REPLACE FUNCTION sync_accepted_trucks()
RETURNS TRIGGER AS $$
DECLARE
  v_freight_id UUID;
  v_accepted_count INT;
  v_drivers UUID[];
BEGIN
  v_freight_id := COALESCE(NEW.freight_id, OLD.freight_id);
  
  -- Calcular valores fora do UPDATE para evitar recursão
  SELECT COUNT(*), array_agg(DISTINCT driver_id)
  INTO v_accepted_count, v_drivers
  FROM freight_assignments 
  WHERE freight_id = v_freight_id
  AND status = 'ACCEPTED';
  
  -- Atualizar apenas se valores mudaram (evita trigger recursivo)
  UPDATE freights
  SET 
    accepted_trucks = v_accepted_count,
    drivers_assigned = COALESCE(v_drivers, ARRAY[]::UUID[])
  WHERE id = v_freight_id
  AND (
    accepted_trucks IS DISTINCT FROM v_accepted_count 
    OR drivers_assigned IS DISTINCT FROM COALESCE(v_drivers, ARRAY[]::UUID[])
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PASSO 6: Reabilitar triggers
ALTER TABLE freights ENABLE TRIGGER trigger_add_freight_chat_participants;
ALTER TABLE freight_assignments ENABLE TRIGGER trigger_add_assigned_driver_to_chat;
ALTER TABLE freight_assignments ENABLE TRIGGER trigger_sync_accepted_trucks;