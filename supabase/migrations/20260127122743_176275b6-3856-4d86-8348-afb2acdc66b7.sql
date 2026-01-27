-- P0 HOTFIX: Atualizar create_additional_profile para ser idempotente
-- Precisa dropar primeiro porque o return type está sendo alterado

DROP FUNCTION IF EXISTS public.create_additional_profile(uuid, text, text, text, text);

CREATE FUNCTION public.create_additional_profile(
  p_user_id uuid,
  p_role text,
  p_document text DEFAULT NULL::text,
  p_full_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_existing_profile RECORD;
  v_document_to_use TEXT;
  v_name_to_use TEXT;
  v_phone_to_use TEXT;
  v_role_enum user_role;
  v_status user_status;
BEGIN
  v_user_id := auth.uid();

  -- Segurança: função exige usuário autenticado
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'profile_id', NULL, 'already_exists', false, 'message', 'Não autenticado');
  END IF;

  -- Segurança: apenas admins podem criar perfis para outros usuários
  IF p_user_id IS NOT NULL AND p_user_id <> v_user_id AND NOT has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'profile_id', NULL, 'already_exists', false, 'message', 'Não autorizado');
  END IF;

  -- Validar role permitido
  IF p_role NOT IN ('PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA') THEN
    RETURN jsonb_build_object('success', false, 'profile_id', NULL, 'already_exists', false, 'message', 'Role inválido: ' || COALESCE(p_role, ''));
  END IF;

  v_role_enum := p_role::user_role;

  -- Regra de aprovação automática por role
  IF p_role IN ('PRODUTOR', 'TRANSPORTADORA') THEN
    v_status := 'APPROVED'::user_status;
  ELSE
    v_status := 'PENDING'::user_status;
  END IF;

  -- ✅ IDEMPOTÊNCIA: se perfil já existe, retorna OK
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = v_user_id AND role = v_role_enum
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'profile_id', v_profile_id, 'already_exists', true, 'message', 'Perfil já existe');
  END IF;

  -- Restrição: não permitir dois tipos de motorista para o mesmo usuário
  IF v_role_enum IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role) THEN
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = v_user_id AND role IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role)
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'profile_id', v_profile_id, 'already_exists', true, 'message', 'Usuário já possui um perfil como motorista');
    END IF;
  END IF;

  -- Buscar dados de perfil existente para reutilizar
  SELECT document, full_name, phone INTO v_existing_profile
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  v_document_to_use := NULLIF(TRIM(COALESCE(p_document, '')), '');
  IF v_document_to_use IS NULL THEN v_document_to_use := v_existing_profile.document; END IF;

  v_name_to_use := NULLIF(TRIM(COALESCE(p_full_name, '')), '');
  IF v_name_to_use IS NULL THEN v_name_to_use := v_existing_profile.full_name; END IF;

  v_phone_to_use := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  IF v_phone_to_use IS NULL THEN v_phone_to_use := v_existing_profile.phone; END IF;

  -- Documento não pode ser de outro usuário
  IF v_document_to_use IS NOT NULL AND v_document_to_use <> '' THEN
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE document = v_document_to_use AND user_id <> v_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'profile_id', NULL, 'already_exists', false, 'message', 'Este CPF/CNPJ já está cadastrado por outro usuário');
    END IF;
  END IF;

  -- Criar perfil
  INSERT INTO profiles (user_id, full_name, phone, document, cpf_cnpj, role, active_mode, status)
  VALUES (
    v_user_id,
    COALESCE(v_name_to_use, 'Usuário'),
    v_phone_to_use,
    v_document_to_use,
    COALESCE(v_document_to_use, ''),
    v_role_enum,
    p_role,
    v_status
  )
  ON CONFLICT (user_id, role)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_profile_id;

  RETURN jsonb_build_object('success', true, 'profile_id', v_profile_id, 'already_exists', false, 'message', 'Perfil criado com sucesso');
END;
$function$;