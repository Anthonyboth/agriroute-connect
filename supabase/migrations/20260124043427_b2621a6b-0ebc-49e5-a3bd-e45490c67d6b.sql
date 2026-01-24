
-- FIX CRITICAL: Casting text to user_role enum in all functions
-- This fixes the "operator does not exist: user_role = text" error

-- 1. Fix create_additional_profile function (receives text, must cast to user_role)
CREATE OR REPLACE FUNCTION public.create_additional_profile(p_user_id uuid, p_role text, p_full_name text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_document text DEFAULT NULL::text)
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
  
  -- Criar novo perfil com o enum correto
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
    v_role_enum,  -- Usar a variável enum
    p_role,       -- active_mode é text
    'PENDING'::user_status
  )
  RETURNING id INTO v_new_profile_id;
  
  RETURN v_new_profile_id;
END;
$function$;

-- 2. Fix handle_new_user function (trigger on auth.users)
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
  
  -- Definir status baseado no role
  IF v_role_enum IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role) THEN
    v_status := 'PENDING'::user_status;
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
  v_document := COALESCE(
    NEW.raw_user_meta_data->>'document',
    NEW.raw_user_meta_data->>'cpf_cnpj',
    ''
  );
  
  -- Extrair telefone dos metadados
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NULL
  );
  
  -- Inserir perfil com todos os campos obrigatórios
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
    v_document,
    v_role_enum,  -- Usar enum
    v_role,       -- active_mode é text
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

-- 3. Fix check_expired_documents function
CREATE OR REPLACE FUNCTION public.check_expired_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualizar CNHs vencidas (com cast explícito)
  UPDATE public.profiles 
  SET cnh_validation_status = 'EXPIRED',
      status = 'REJECTED'::user_status
  WHERE cnh_expiry_date < CURRENT_DATE 
    AND cnh_validation_status = 'VALIDATED'
    AND role = 'MOTORISTA'::user_role;
    
  -- Atualizar CRLVs vencidos
  UPDATE public.vehicles v
  SET vehicle_validation_status = 'REJECTED'
  FROM public.profiles p
  WHERE v.driver_id = p.id
    AND v.crlv_expiry_date < CURRENT_DATE 
    AND v.vehicle_validation_status = 'VALIDATED';
    
  -- Atualizar seguros vencidos  
  UPDATE public.vehicles v
  SET status = 'REJECTED'
  FROM public.profiles p
  WHERE v.driver_id = p.id
    AND v.insurance_expiry_date < CURRENT_DATE
    AND v.status = 'APPROVED';
END;
$function$;

-- 4. Fix check_low_ratings function
CREATE OR REPLACE FUNCTION public.check_low_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Bloquear motoristas com rating menor que 3.0 e mais de 5 avaliações (com cast)
  UPDATE public.profiles 
  SET rating_locked = TRUE,
      status = 'REJECTED'::user_status
  WHERE role = 'MOTORISTA'::user_role
    AND rating < 3.0 
    AND total_ratings > 5
    AND rating_locked = FALSE;
END;
$function$;

-- 5. Fix check_document_role_limit trigger function
CREATE OR REPLACE FUNCTION public.check_document_role_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_role_count INT;
  existing_motorista_count INT;
BEGIN
  -- Verificar se documento já tem perfil do mesmo tipo
  SELECT COUNT(*) INTO existing_role_count
  FROM profiles
  WHERE document = NEW.document 
    AND role = NEW.role
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF existing_role_count > 0 THEN
    RAISE EXCEPTION 'Este CPF/CNPJ já possui um cadastro como %. Cada documento pode ter apenas um perfil de cada tipo.', NEW.role;
  END IF;
  
  -- Verificar se documento já tem MOTORISTA ou MOTORISTA_AFILIADO (não pode ter os dois)
  IF NEW.role IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role) THEN
    SELECT COUNT(*) INTO existing_motorista_count
    FROM profiles
    WHERE document = NEW.document 
      AND role IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role)
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_motorista_count > 0 THEN
      RAISE EXCEPTION 'Este CPF/CNPJ já possui um cadastro como motorista. Não é possível ter motorista autônomo e afiliado ao mesmo tempo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 6. Fix is_transport_company function (já tinha o cast mas vamos garantir)
CREATE OR REPLACE FUNCTION public.is_transport_company(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id 
    AND role = 'TRANSPORTADORA'::user_role
  )
$function$;
