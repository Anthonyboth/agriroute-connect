-- Criar função create_additional_profile para permitir usuários criarem perfis adicionais
CREATE OR REPLACE FUNCTION public.create_additional_profile(
  p_user_id UUID,
  p_role TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_document TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_new_profile_id UUID;
  v_existing_profile RECORD;
  v_document_to_use TEXT;
  v_name_to_use TEXT;
  v_phone_to_use TEXT;
BEGIN
  -- Validar role permitido
  IF p_role NOT IN ('PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA') THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END IF;
  
  -- Verificar se usuário já tem perfil com esta role
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role = p_role) THEN
    RAISE EXCEPTION 'Usuário já possui um perfil como %', p_role;
  END IF;
  
  -- Verificar se é motorista/afiliado e já tem outro tipo de motorista
  IF p_role IN ('MOTORISTA', 'MOTORISTA_AFILIADO') THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')) THEN
      RAISE EXCEPTION 'Usuário já possui um perfil como motorista';
    END IF;
  END IF;
  
  -- Buscar dados do perfil existente para reutilizar documento
  SELECT document, full_name, phone INTO v_existing_profile 
  FROM profiles 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  -- Usar dados passados ou do perfil existente
  v_document_to_use := COALESCE(NULLIF(p_document, ''), v_existing_profile.document);
  v_name_to_use := COALESCE(NULLIF(p_full_name, ''), v_existing_profile.full_name);
  v_phone_to_use := COALESCE(NULLIF(p_phone, ''), v_existing_profile.phone);
  
  -- Verificar se documento está sendo usado por OUTRO usuário
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE document = v_document_to_use 
    AND user_id != p_user_id
  ) THEN
    RAISE EXCEPTION 'Este CPF/CNPJ já está cadastrado por outro usuário';
  END IF;
  
  -- Criar novo perfil
  INSERT INTO profiles (
    user_id,
    full_name,
    phone,
    document,
    cpf_cnpj,
    role,
    active_mode,
    status
  ) VALUES (
    p_user_id,
    v_name_to_use,
    v_phone_to_use,
    v_document_to_use,
    v_document_to_use,
    p_role,
    p_role,
    'PENDING'
  )
  RETURNING id INTO v_new_profile_id;
  
  RETURN v_new_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;