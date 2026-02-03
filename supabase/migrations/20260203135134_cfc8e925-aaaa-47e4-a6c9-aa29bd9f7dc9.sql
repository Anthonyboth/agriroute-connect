-- Remover a policy problemática que causa recursão infinita
DROP POLICY IF EXISTS profiles_select_affiliated_drivers ON profiles;

-- Criar função SECURITY DEFINER para verificar se o usuário é dono de uma transportadora
-- que tem o motorista afiliado, SEM acionar RLS em profiles
CREATE OR REPLACE FUNCTION is_affiliated_driver_of_my_company(p_driver_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_caller_profile_id UUID;
BEGIN
  -- Obter o profile.id do usuário logado diretamente (sem RLS)
  SELECT id INTO v_caller_profile_id 
  FROM profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;
  
  IF v_caller_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se existe uma transportadora do caller que tem esse motorista afiliado
  RETURN EXISTS (
    SELECT 1 
    FROM transport_companies tc
    JOIN company_drivers cd ON cd.company_id = tc.id
    WHERE tc.profile_id = v_caller_profile_id
      AND cd.driver_profile_id = p_driver_profile_id
      AND cd.status IN ('ACTIVE', 'INACTIVE', 'PENDING')
  );
END;
$$;

-- Recriar a policy usando a função SECURITY DEFINER
CREATE POLICY profiles_select_affiliated_drivers
ON profiles
FOR SELECT
USING (is_affiliated_driver_of_my_company(id));

-- Garantir permissões
GRANT EXECUTE ON FUNCTION is_affiliated_driver_of_my_company(UUID) TO authenticated;