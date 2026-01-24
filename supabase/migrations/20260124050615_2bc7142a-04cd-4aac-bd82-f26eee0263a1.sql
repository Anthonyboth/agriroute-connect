-- =====================================================
-- FIX: Conditional approval based on role
-- PRODUTOR and TRANSPORTADORA = auto-approved (APPROVED)
-- MOTORISTA, MOTORISTA_AFILIADO, PRESTADOR_SERVICOS = requires approval (PENDING)
-- =====================================================

-- 1. Drop the existing function first to avoid parameter name conflict
DROP FUNCTION IF EXISTS public.create_additional_profile(UUID, TEXT, TEXT, TEXT, TEXT);

-- 2. Update handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role text;
  v_role_enum user_role;
  v_status user_status;
  v_full_name text;
  v_document text;
  v_phone text;
BEGIN
  -- Extrair role dos metadados ou usar padrão
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'PRODUTOR');
  
  -- Normalizar role para valores válidos do enum
  IF v_role = 'MOTORISTA_AUTONOMO' THEN
    v_role := 'MOTORISTA';
  END IF;
  
  -- Validar e fazer cast para enum
  BEGIN
    v_role_enum := v_role::user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    v_role_enum := 'PRODUTOR'::user_role;
    v_role := 'PRODUTOR';
  END;
  
  -- ============================================
  -- REGRA DE APROVAÇÃO AUTOMÁTICA POR ROLE
  -- ============================================
  -- PRODUTOR e TRANSPORTADORA = aprovação automática
  -- MOTORISTA, MOTORISTA_AFILIADO, PRESTADOR_SERVICOS = requer aprovação
  IF v_role IN ('PRODUTOR', 'TRANSPORTADORA') THEN
    v_status := 'APPROVED'::user_status;
  ELSE
    v_status := 'PENDING'::user_status;
  END IF;
  
  -- Extrair nome completo
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Extrair documento (cpf_cnpj) dos metadados
  v_document := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'document',
    NEW.raw_user_meta_data->>'cpf_cnpj',
    ''
  )), '');
  
  -- Extrair telefone dos metadados
  v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  
  -- Inserir perfil com status correto por role
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    phone,
    document,
    cpf_cnpj,
    role,
    active_mode,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_full_name,
    LOWER(TRIM(NEW.email)),
    v_phone,
    v_document,
    COALESCE(v_document, ''),
    v_role_enum,
    v_role,
    v_status,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3. Recreate create_additional_profile function with conditional approval
CREATE OR REPLACE FUNCTION public.create_additional_profile(
  p_user_id UUID,
  p_role TEXT,
  p_document TEXT DEFAULT NULL,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_new_profile_id UUID;
  v_existing_profile RECORD;
  v_document_to_use TEXT;
  v_name_to_use TEXT;
  v_phone_to_use TEXT;
  v_role_enum user_role;
  v_status user_status;
BEGIN
  -- Validar role permitido E fazer cast para enum
  IF p_role NOT IN ('PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA') THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END IF;
  
  -- Cast explícito para o enum user_role
  v_role_enum := p_role::user_role;
  
  -- ============================================
  -- REGRA DE APROVAÇÃO AUTOMÁTICA POR ROLE
  -- ============================================
  IF p_role IN ('PRODUTOR', 'TRANSPORTADORA') THEN
    v_status := 'APPROVED'::user_status;
  ELSE
    v_status := 'PENDING'::user_status;
  END IF;
  
  -- Verificar se usuário já tem perfil com esta role
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role = v_role_enum) THEN
    RAISE EXCEPTION 'Usuário já possui um perfil como %', p_role;
  END IF;
  
  -- Verificar se é motorista/afiliado e já tem outro tipo de motorista
  IF v_role_enum IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role) THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND role IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role)) THEN
      RAISE EXCEPTION 'Usuário já possui um perfil como motorista';
    END IF;
  END IF;
  
  -- Buscar dados do perfil existente para reutilizar documento
  SELECT document, full_name, phone INTO v_existing_profile 
  FROM profiles 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  -- Usar dados passados ou do perfil existente
  v_document_to_use := NULLIF(TRIM(COALESCE(p_document, '')), '');
  IF v_document_to_use IS NULL OR v_document_to_use = '' THEN
    v_document_to_use := v_existing_profile.document;
  END IF;
  
  v_name_to_use := NULLIF(TRIM(COALESCE(p_full_name, '')), '');
  IF v_name_to_use IS NULL OR v_name_to_use = '' THEN
    v_name_to_use := v_existing_profile.full_name;
  END IF;
  
  v_phone_to_use := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  IF v_phone_to_use IS NULL OR v_phone_to_use = '' THEN
    v_phone_to_use := v_existing_profile.phone;
  END IF;
  
  -- Verificar se documento está sendo usado por OUTRO usuário
  IF v_document_to_use IS NOT NULL AND v_document_to_use != '' THEN
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE document = v_document_to_use 
      AND user_id != p_user_id
    ) THEN
      RAISE EXCEPTION 'Este CPF/CNPJ já está cadastrado por outro usuário';
    END IF;
  END IF;
  
  -- Criar novo perfil com status correto por role
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
    COALESCE(v_name_to_use, 'Usuário'),
    v_phone_to_use,
    v_document_to_use,
    COALESCE(v_document_to_use, ''),
    v_role_enum,
    p_role,
    v_status  -- Status condicional por role
  )
  RETURNING id INTO v_new_profile_id;
  
  RETURN v_new_profile_id;
END;
$function$;

-- 4. Fix existing PRODUTOR and TRANSPORTADORA profiles that are incorrectly PENDING
UPDATE public.profiles 
SET status = 'APPROVED'::user_status, updated_at = NOW()
WHERE role IN ('PRODUTOR'::user_role, 'TRANSPORTADORA'::user_role)
AND status = 'PENDING'::user_status;