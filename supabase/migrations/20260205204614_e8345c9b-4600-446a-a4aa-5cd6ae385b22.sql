-- Fix: Atualizar policy others_view_trip_progress para verificar role diretamente em profiles
-- O problema é que has_role() usa a tabela user_roles com app_role enum (producer),
-- mas os perfis usam user_role enum (PRODUTOR) na coluna profiles.role

-- Dropar policy existente
DROP POLICY IF EXISTS "others_view_trip_progress" ON driver_trip_progress;

-- Criar nova policy que verifica role diretamente em profiles
CREATE POLICY "others_view_trip_progress" 
ON driver_trip_progress 
FOR SELECT 
TO authenticated
USING (
  -- Produtores podem ver trip_progress dos fretes deles
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN freights f ON f.producer_id = p.id
    WHERE p.user_id = auth.uid()
      AND p.role = 'PRODUTOR'
      AND f.id = driver_trip_progress.freight_id
  )
  OR
  -- Transportadoras podem ver trip_progress de motoristas afiliados
  EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON p.id = tc.profile_id
    JOIN company_drivers cd ON cd.company_id = tc.id
    WHERE p.user_id = auth.uid()
      AND cd.driver_profile_id = driver_trip_progress.driver_id
      AND cd.status = 'ACTIVE'
  )
  OR
  -- Admins podem ver tudo
  is_admin()
);

-- Adicionar comentário explicativo
COMMENT ON POLICY "others_view_trip_progress" ON driver_trip_progress IS 
'Permite produtores verem trip_progress de seus fretes e transportadoras verem de motoristas afiliados';