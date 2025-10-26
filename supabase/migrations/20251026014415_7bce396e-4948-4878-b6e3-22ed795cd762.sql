-- ============================================
-- MIGRATION: Company Assignment Sharing & Permissions
-- ============================================

-- 1. Trigger para copiar minimum_antt_price automaticamente em novos assignments
CREATE OR REPLACE FUNCTION copy_antt_price_to_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Copiar minimum_antt_price do frete para o assignment
  IF NEW.minimum_antt_price IS NULL THEN
    SELECT minimum_antt_price INTO NEW.minimum_antt_price
    FROM freights
    WHERE id = NEW.freight_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_copy_antt_price ON freight_assignments;
CREATE TRIGGER trigger_copy_antt_price
  BEFORE INSERT ON freight_assignments
  FOR EACH ROW
  EXECUTE FUNCTION copy_antt_price_to_assignment();

-- 2. RLS Policy: Transportadoras podem criar assignments
DROP POLICY IF EXISTS "Companies can create assignments" ON freight_assignments;
CREATE POLICY "Companies can create assignments"
ON freight_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT tc.id 
    FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- 3. RLS Policy: Transportadoras e motoristas podem atualizar
DROP POLICY IF EXISTS "Companies and drivers can update their assignments" ON freight_assignments;
CREATE POLICY "Companies and drivers can update their assignments"
ON freight_assignments
FOR UPDATE
TO authenticated
USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  company_id IN (
    SELECT tc.id 
    FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR
  is_current_user_producer_of_freight(freight_id)
  OR
  is_admin()
);

-- 4. Comentários
COMMENT ON POLICY "Companies can create assignments" ON freight_assignments 
IS 'Permite que transportadoras criem assignments para seus motoristas afiliados';

COMMENT ON POLICY "Companies and drivers can update their assignments" ON freight_assignments 
IS 'Permite que transportadoras e motoristas atualizem o status dos assignments';