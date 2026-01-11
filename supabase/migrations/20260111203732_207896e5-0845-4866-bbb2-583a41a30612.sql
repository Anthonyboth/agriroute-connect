-- Fix hardcoded encryption key security issue
-- Drop existing functions and recreate without default key parameter
-- Keys should be retrieved from Supabase Vault in production

-- First drop the existing functions
DROP FUNCTION IF EXISTS public.encrypt_sensitive_data(text, text);
DROP FUNCTION IF EXISTS public.decrypt_sensitive_data(text, text);

-- Recreate encrypt_sensitive_data without default key
CREATE FUNCTION public.encrypt_sensitive_data(data text, key text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF data IS NULL OR key IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN encode(encrypt(convert_to(data, 'utf8'), convert_to(key, 'utf8'), 'aes'), 'base64');
END;
$$;

-- Recreate decrypt_sensitive_data without default key
CREATE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF encrypted_data IS NULL OR key IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN convert_from(decrypt(decode(encrypted_data, 'base64'), convert_to(key, 'utf8'), 'aes'), 'utf8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Add comment documenting proper usage
COMMENT ON FUNCTION public.encrypt_sensitive_data(text, text) IS 
'Encrypts sensitive data using AES encryption. 
Key MUST be provided explicitly - retrieve from Supabase Vault:
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''encryption_key'';
DO NOT use hardcoded keys in production.';

COMMENT ON FUNCTION public.decrypt_sensitive_data(text, text) IS 
'Decrypts sensitive data using AES encryption.
Key MUST be provided explicitly - retrieve from Supabase Vault:
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''encryption_key'';
DO NOT use hardcoded keys in production.';