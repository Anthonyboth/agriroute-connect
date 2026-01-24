
-- =============================================================
-- FIX: cpf_cnpj_not_empty constraint blocks initial signup
-- The constraint requires cpf_cnpj to be non-empty, but users
-- may not have a document during initial registration.
-- Solution: Allow empty cpf_cnpj but require it before APPROVED status
-- =============================================================

-- Step 1: Drop the overly restrictive constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS cpf_cnpj_not_empty;

-- Step 2: Add a more flexible constraint that allows empty document for PENDING status
-- Document is required before user can be APPROVED
ALTER TABLE public.profiles ADD CONSTRAINT cpf_cnpj_validation 
CHECK (
  -- Allow empty/null cpf_cnpj only for PENDING status
  (status = 'PENDING'::user_status AND (cpf_cnpj IS NULL OR TRIM(cpf_cnpj) = '')) 
  OR 
  -- For non-PENDING status, cpf_cnpj must be non-empty
  (cpf_cnpj IS NOT NULL AND TRIM(cpf_cnpj) <> '')
);

-- Step 3: Add comment explaining the constraint
COMMENT ON CONSTRAINT cpf_cnpj_validation ON public.profiles IS 
'cpf_cnpj can be empty during initial registration (PENDING status) but must be filled before approval. Updated 2026-01-24';

-- Step 4: Update handle_new_user to handle empty documents gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    -- Se o role não for válido, usar PRODUTOR como default
    v_role_enum := 'PRODUTOR'::user_role;
    v_role := 'PRODUTOR';
  END;
  
  -- Status inicial sempre PENDING
  v_status := 'PENDING'::user_status;
  
  -- Extrair nome completo
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Extrair documento (cpf_cnpj) dos metadados - pode estar vazio inicialmente
  v_document := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'document',
    NEW.raw_user_meta_data->>'cpf_cnpj',
    ''
  )), '');
  
  -- Extrair telefone dos metadados
  v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  
  -- Inserir perfil com campos necessários
  -- cpf_cnpj pode ser NULL para PENDING status (nova constraint permite)
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    phone,
    document,
    cpf_cnpj,
    role,
    active_mode,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    v_full_name,
    v_phone,
    v_document,
    COALESCE(v_document, ''),  -- cpf_cnpj NOT NULL, usar string vazia se documento for null
    v_role_enum,
    v_role,
    v_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

-- Step 5: Update create_additional_profile to handle empty documents
CREATE OR REPLACE FUNCTION public.create_additional_profile(
  p_user_id uuid, 
  p_role text, 
  p_full_name text DEFAULT NULL::text, 
  p_phone text DEFAULT NULL::text, 
  p_document text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_profile_id UUID;
  v_existing_profile RECORD;
  v_document_to_use TEXT;
  v_name_to_use TEXT;
  v_phone_to_use TEXT;
  v_role_enum user_role;
BEGIN
  -- Validar role permitido E fazer cast para enum
  IF p_role NOT IN ('PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA') THEN
    RAISE EXCEPTION 'Role inválido: %', p_role;
  END IF;
  
  -- Cast explícito para o enum user_role
  v_role_enum := p_role::user_role;
  
  -- Verificar se usuário já tem perfil com esta role (usando enum)
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
  
  -- Verificar se documento está sendo usado por OUTRO usuário (apenas se documento foi fornecido)
  IF v_document_to_use IS NOT NULL AND v_document_to_use != '' THEN
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE document = v_document_to_use 
      AND user_id != p_user_id
    ) THEN
      RAISE EXCEPTION 'Este CPF/CNPJ já está cadastrado por outro usuário';
    END IF;
  END IF;
  
  -- Criar novo perfil com o enum correto
  -- cpf_cnpj usa COALESCE para garantir string vazia se documento for null
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
    COALESCE(v_document_to_use, ''),  -- NOT NULL, usar string vazia
    v_role_enum,
    p_role,
    'PENDING'::user_status
  )
  RETURNING id INTO v_new_profile_id;
  
  RETURN v_new_profile_id;
END;
$function$;

-- Step 6: Verify the new constraint is in place
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cpf_cnpj_validation'
  ) THEN
    RAISE EXCEPTION 'Constraint cpf_cnpj_validation was not created!';
  END IF;
  RAISE NOTICE 'Constraint cpf_cnpj_validation created successfully';
END;
$$;
