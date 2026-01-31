-- Criar função RPC para obter o próprio profile ID de forma segura (bypassa RLS)
-- Esta função é usada durante o cadastro quando a sessão ainda não está totalmente ativa

CREATE OR REPLACE FUNCTION public.get_own_profile_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Validar que o user_id corresponde ao usuário autenticado
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: você só pode consultar seu próprio perfil';
  END IF;
  
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  RETURN v_profile_id;
END;
$$;

-- Garantir que a função pode ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_own_profile_id(uuid) TO authenticated;