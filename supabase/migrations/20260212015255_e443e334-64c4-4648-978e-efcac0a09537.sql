
-- 1. Corrigir perfis existentes com email NULL - preencher com email do auth.users
UPDATE profiles 
SET email = LOWER(TRIM(au.email)),
    updated_at = NOW()
FROM auth.users au 
WHERE profiles.user_id = au.id 
  AND (profiles.email IS NULL OR profiles.email = '');

-- 2. Garantir que email nunca mais seja NULL em novos registros
-- Adicionar constraint NOT NULL com default vazio (para não quebrar inserts existentes)
-- Mas melhor: criar trigger que auto-preenche email do auth.users se não fornecido

CREATE OR REPLACE FUNCTION public.auto_fill_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se email está NULL ou vazio, buscar do auth.users
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    SELECT LOWER(TRIM(email)) INTO NEW.email
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_auto_fill_profile_email ON profiles;
CREATE TRIGGER trg_auto_fill_profile_email
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fill_profile_email();
