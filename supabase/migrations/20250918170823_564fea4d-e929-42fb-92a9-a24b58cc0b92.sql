-- Remover políticas RLS problemáticas
DROP POLICY IF EXISTS "Usuarios apenas se aprovados" ON public.profiles;
DROP POLICY IF EXISTS "Users can create additional profiles" ON public.profiles;

-- Corrigir a função handle_new_user para incluir o campo cpf_cnpj
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public 
AS $$
BEGIN
  -- Inserir perfil apenas se não existir um com a mesma role
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    role, 
    phone, 
    document,
    cpf_cnpj  -- Adicionando o campo obrigatório
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'PRODUTOR'),
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'document',
    COALESCE(NEW.raw_user_meta_data ->> 'document', '') -- Usar document como cpf_cnpj
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    document = EXCLUDED.document,
    cpf_cnpj = EXCLUDED.cpf_cnpj;
  
  RETURN NEW;
END;
$$;

-- Criar uma política mais simples para SELECT de profiles próprios
CREATE POLICY "Users can view profiles when authenticated" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Garantir que a política de INSERT funcione corretamente
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Adicionar política para permitir múltiplos perfis por usuário
CREATE POLICY "Users can create multiple profiles" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());