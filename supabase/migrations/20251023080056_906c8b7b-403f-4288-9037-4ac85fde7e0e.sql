-- =========================================
-- CORREÇÃO 1: RLS para permitir transportadora ver motoristas afiliados
-- =========================================

-- Dropar policy restritiva atual se existir
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own_company_or_admin" ON profiles;

-- Criar nova policy que permite transportadora ver motoristas
CREATE POLICY "profiles_select_own_company_or_admin"
ON profiles FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()  -- Vê próprio perfil
    OR
    has_role(auth.uid(), 'admin'::app_role)  -- Admin vê tudo
    OR
    id IN (  -- Transportadora vê motoristas afiliados
        SELECT cd.driver_profile_id 
        FROM company_drivers cd
        JOIN transport_companies tc ON tc.id = cd.company_id
        JOIN profiles p ON p.id = tc.profile_id
        WHERE p.user_id = auth.uid()
        AND cd.status IN ('ACTIVE', 'INACTIVE', 'PENDING', 'LEFT')
    )
);