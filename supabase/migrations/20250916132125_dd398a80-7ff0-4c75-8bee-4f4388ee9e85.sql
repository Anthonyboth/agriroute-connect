-- Adicionar PRESTADOR_SERVICOS ao enum user_role
ALTER TYPE user_role ADD VALUE 'PRESTADOR_SERVICOS';

-- Atualizar a função handle_new_user para suportar o novo tipo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;