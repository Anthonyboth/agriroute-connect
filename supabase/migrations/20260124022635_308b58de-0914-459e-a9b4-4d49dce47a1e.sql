
-- Fix the handle_new_user trigger to include cpf_cnpj field (required NOT NULL field)
-- This is the ROOT CAUSE of "Perfil não encontrado" errors after signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_status user_status;
  v_full_name text;
  v_document text;
  v_phone text;
BEGIN
  -- Extrair role dos metadados ou usar padrão
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'PRODUTOR');
  
  -- Definir status baseado no role
  IF v_role IN ('MOTORISTA', 'MOTORISTA_AUTONOMO', 'MOTORISTA_AFILIADO') THEN
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
    v_document, -- cpf_cnpj is NOT NULL, must be provided
    v_role,
    v_role, -- active_mode for backward compatibility
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
    -- Log error but don't fail user creation - IMPROVED: include more context
    RAISE WARNING 'Error in handle_new_user for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.handle_new_user IS 'Creates initial profile for new users. Fixed: now includes cpf_cnpj (NOT NULL), phone, document, and active_mode fields.';
