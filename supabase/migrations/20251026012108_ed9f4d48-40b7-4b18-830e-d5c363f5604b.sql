-- Remove policy antiga que não inclui empresas
DROP POLICY IF EXISTS "Drivers and producers can view assignments" ON freight_assignments;

-- Cria nova policy incluindo company_id para empresas visualizarem seus assignments
CREATE POLICY "Companies, drivers and producers can view assignments"
ON freight_assignments
FOR SELECT
TO authenticated
USING (
  -- Motorista atribuído
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR
  -- Produtor do frete
  is_current_user_producer_of_freight(freight_id)
  OR
  -- Empresa que criou o assignment (FIX CRÍTICO)
  company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
  OR
  -- Admin
  is_admin()
);

-- Adicionar comentário explicativo
COMMENT ON POLICY "Companies, drivers and producers can view assignments" ON freight_assignments 
IS 'Permite que empresas vejam seus assignments, motoristas vejam suas atribuições, produtores vejam seus fretes e admins vejam tudo';