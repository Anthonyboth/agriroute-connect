-- Permitir que um usuário tenha múltiplos perfis (motorista e produtor)
-- Primeiro, vamos criar uma constraint única em (user_id, role) para evitar duplicatas da mesma role

-- Verificar se já existe constraint única no user_id
DO $$
BEGIN
  -- Remover constraint única de user_id se existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_key' 
    AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_user_id_key;
  END IF;
  
  -- Adicionar constraint única em (user_id, role) se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_role_key' 
    AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- Modificar a função handle_new_user para não duplicar perfis
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Inserir perfil apenas se não existir um com a mesma role
  INSERT INTO public.profiles (user_id, full_name, role, phone, document)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'PRODUTOR'),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'document'
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Criar função para adicionar novo perfil de role diferente
CREATE OR REPLACE FUNCTION public.create_additional_profile(
  p_user_id uuid,
  p_role user_role,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_document text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_profile_id uuid;
  existing_profile RECORD;
BEGIN
  -- Verificar se o usuário já tem um perfil existente para copiar dados básicos
  SELECT full_name, phone, document 
  INTO existing_profile
  FROM profiles 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  -- Inserir novo perfil
  INSERT INTO profiles (
    user_id, 
    role, 
    full_name, 
    phone, 
    document,
    status
  ) VALUES (
    p_user_id,
    p_role,
    COALESCE(p_full_name, existing_profile.full_name),
    COALESCE(p_phone, existing_profile.phone),
    COALESCE(p_document, existing_profile.document),
    'PENDING'
  )
  RETURNING id INTO new_profile_id;
  
  RETURN new_profile_id;
END;
$$;

-- Criar política RLS para permitir que usuários criem perfis adicionais
CREATE POLICY "Users can create additional profiles" 
ON profiles 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles p2 
    WHERE p2.user_id = auth.uid() 
    AND p2.role != role
  )
);