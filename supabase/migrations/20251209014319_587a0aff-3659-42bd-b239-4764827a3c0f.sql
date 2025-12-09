-- Corrigir a função handle_new_user para usar o tipo correto user_status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_status user_status;
  v_full_name text;
BEGIN
  -- Extrair role dos metadados ou usar padrão
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'MOTORISTA');
  
  -- Definir status baseado no role
  IF v_role IN ('MOTORISTA', 'MOTORISTA_AUTONOMO') THEN
    v_status := 'pending_approval'::user_status;
  ELSE
    v_status := 'active'::user_status;
  END IF;
  
  -- Extrair nome completo
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Inserir perfil com tratamento de conflito
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    full_name,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    v_full_name,
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
    RAISE WARNING 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;