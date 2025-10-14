-- Update handle_new_user function to sanitize document on backend
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_doc text;
BEGIN
  -- Sanitize document: remove all non-digit characters
  v_doc := regexp_replace(
    COALESCE(NEW.raw_user_meta_data ->> 'document', ''), 
    '[^0-9]', 
    '', 
    'g'
  );
  
  -- Insert profile with sanitized document
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    role, 
    phone, 
    document,
    cpf_cnpj
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'PRODUTOR'),
    NEW.raw_user_meta_data ->> 'phone',
    NULLIF(v_doc, ''),
    NULLIF(v_doc, '')
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    document = EXCLUDED.document,
    cpf_cnpj = EXCLUDED.cpf_cnpj;
  
  RETURN NEW;
END;
$function$;