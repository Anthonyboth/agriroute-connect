-- Step 1: Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Step 2: Create index for email performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Step 3: Populate existing emails (one-time migration)
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id AND p.email IS NULL;

-- Step 4: Handle document duplicates - keep only the most recent profile for each document
-- First, identify and delete older duplicate profiles
WITH duplicates AS (
  SELECT id, document,
         ROW_NUMBER() OVER (PARTITION BY document ORDER BY created_at DESC) as rn
  FROM public.profiles
  WHERE document IS NOT NULL AND document != ''
)
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 5: Now create unique index for document (CPF/CNPJ)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_document_unique 
ON public.profiles(document) 
WHERE document IS NOT NULL AND document != '';

-- Step 6: Update handle_new_user trigger to copy email
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
  
  -- Insert profile with sanitized document and email
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    role, 
    phone, 
    document,
    cpf_cnpj,
    email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'PRODUTOR'),
    NEW.raw_user_meta_data ->> 'phone',
    NULLIF(v_doc, ''),
    NULLIF(v_doc, ''),
    NEW.email
  )
  ON CONFLICT (user_id, role) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    document = EXCLUDED.document,
    cpf_cnpj = EXCLUDED.cpf_cnpj,
    email = EXCLUDED.email;
  
  RETURN NEW;
END;
$function$;