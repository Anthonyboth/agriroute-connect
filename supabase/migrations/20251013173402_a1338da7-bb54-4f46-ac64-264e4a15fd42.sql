-- Política RLS para motoristas de empresa verem apenas fretes da transportadora
CREATE POLICY "Company drivers can view company freights"
ON freights FOR SELECT
TO authenticated
USING (
  -- Motoristas independentes veem fretes públicos
  (company_id IS NULL AND driver_id IS NULL)
  OR
  -- Motoristas de empresa veem fretes da sua transportadora
  (company_id IN (
    SELECT company_id 
    FROM company_drivers 
    WHERE driver_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    AND status = 'ACTIVE'
  ))
  OR
  -- Sempre ver fretes que já aceitou
  (driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  OR
  -- Produtor vê seus próprios fretes
  (producer_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
);