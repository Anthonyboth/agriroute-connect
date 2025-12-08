-- Update handle_new_user to auto-approve non-driver roles
-- Only MOTORISTA and MOTORISTA_AFILIADO require manual approval
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_doc text;
  v_role user_role;
  v_status text;
BEGIN
  -- Sanitize document: remove all non-digit characters
  v_doc := regexp_replace(
    COALESCE(NEW.raw_user_meta_data ->> 'document', ''), 
    '[^0-9]', 
    '', 
    'g'
  );
  
  -- Get the role
  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'PRODUTOR');
  
  -- Determine status based on role:
  -- PRODUTOR, PRESTADOR_SERVICOS, TRANSPORTADORA = auto-approved
  -- MOTORISTA, MOTORISTA_AFILIADO = require manual approval (PENDING)
  IF v_role IN ('PRODUTOR', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA') THEN
    v_status := 'APPROVED';
  ELSE
    v_status := 'PENDING';
  END IF;
  
  -- Insert profile with sanitized document, email, and appropriate status
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    role, 
    phone, 
    document,
    cpf_cnpj,
    email,
    status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    v_role,
    NEW.raw_user_meta_data ->> 'phone',
    NULLIF(v_doc, ''),
    NULLIF(v_doc, ''),
    NEW.email,
    v_status
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    document = EXCLUDED.document,
    cpf_cnpj = EXCLUDED.cpf_cnpj,
    email = EXCLUDED.email,
    status = EXCLUDED.status;
  
  RETURN NEW;
END;
$function$;