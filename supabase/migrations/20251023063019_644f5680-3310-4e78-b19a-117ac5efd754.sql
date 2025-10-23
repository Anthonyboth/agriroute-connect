-- Permitir que transportadoras vejam perfis de motoristas vinculados
-- Sem comprometer a segurança de outros usuários

CREATE POLICY "Companies can view affiliated drivers"
ON public.profiles
FOR SELECT
USING (
  -- Permite ver seu próprio perfil
  user_id = auth.uid()
  
  -- OU é admin
  OR is_admin()
  
  -- OU é um motorista vinculado a uma transportadora que o usuário gerencia
  OR id IN (
    SELECT cd.driver_profile_id 
    FROM company_drivers cd
    INNER JOIN transport_companies tc ON tc.id = cd.company_id
    INNER JOIN profiles p ON p.id = tc.profile_id
    WHERE p.user_id = auth.uid()
  )
);