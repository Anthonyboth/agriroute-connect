
-- =============================================
-- FIX: Permitir transportadoras e todos os papéis relevantes enviar propostas
-- =============================================

-- 1. Corrigir freight_proposals INSERT - incluir carrier
DROP POLICY IF EXISTS "Drivers can insert proposals for open freights" ON freight_proposals;

CREATE POLICY "Authenticated users can insert proposals for open freights"
ON freight_proposals FOR INSERT
TO authenticated
WITH CHECK (
  -- O proponente deve ser o próprio usuário
  driver_id = get_my_profile_id()
  -- Papel: motorista, motorista afiliado OU transportadora
  AND (
    has_role(auth.uid(), 'driver'::app_role) 
    OR has_role(auth.uid(), 'affiliated_driver'::app_role)
    OR has_role(auth.uid(), 'carrier'::app_role)
  )
  -- Veículo próprio OU veículo da empresa OU é transportadora (tem frota)
  AND (
    EXISTS (SELECT 1 FROM vehicles v WHERE v.driver_id = get_my_profile_id())
    OR EXISTS (SELECT 1 FROM company_vehicle_assignments cva WHERE cva.driver_profile_id = get_my_profile_id() AND cva.removed_at IS NULL)
    OR has_role(auth.uid(), 'carrier'::app_role)
  )
  -- Frete deve estar aberto e com vagas
  AND EXISTS (
    SELECT 1 FROM freights f
    WHERE f.id = freight_proposals.freight_id
      AND f.producer_id IS NOT NULL
      AND COALESCE(f.is_guest_freight, false) = false
      AND f.status IN ('OPEN'::freight_status, 'IN_NEGOTIATION'::freight_status)
      AND f.accepted_trucks < f.required_trucks
  )
);

-- 2. Adicionar INSERT policy para flexible_freight_proposals
DROP POLICY IF EXISTS "Users can insert flexible proposals" ON flexible_freight_proposals;

CREATE POLICY "Users can insert flexible proposals"
ON flexible_freight_proposals FOR INSERT
TO authenticated
WITH CHECK (
  driver_id = get_my_profile_id()
  AND (
    has_role(auth.uid(), 'driver'::app_role)
    OR has_role(auth.uid(), 'affiliated_driver'::app_role)
    OR has_role(auth.uid(), 'carrier'::app_role)
  )
  AND EXISTS (
    SELECT 1 FROM freights f
    WHERE f.id = flexible_freight_proposals.freight_id
      AND f.status IN ('OPEN'::freight_status, 'IN_NEGOTIATION'::freight_status)
      AND f.accepted_trucks < f.required_trucks
  )
);

-- 3. Garantir SELECT para flexible_freight_proposals (se não existir)
DROP POLICY IF EXISTS "Users can view proposals for their freights" ON flexible_freight_proposals;

CREATE POLICY "Users can view flexible proposals"
ON flexible_freight_proposals FOR SELECT
TO authenticated
USING (
  driver_id = get_my_profile_id()
  OR freight_id IN (
    SELECT id FROM freights WHERE producer_id = get_my_profile_id()
  )
  OR is_admin()
);
