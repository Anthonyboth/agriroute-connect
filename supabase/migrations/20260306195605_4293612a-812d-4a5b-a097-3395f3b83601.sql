
-- 1. Create a trigger function that auto-encrypts password_hash on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.encrypt_certificate_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Only process if password_hash is being set/changed and is not already encrypted
  IF NEW.password_hash IS NOT NULL AND NEW.password_hash != '' THEN
    -- Skip if already encrypted (base64 encoded AES output)
    IF NEW.password_hash ~ '^[A-Za-z0-9+/]+=*$' AND length(NEW.password_hash) > 20 AND NEW.encryption_key_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Get encryption key
    SELECT key_value INTO encryption_key
    FROM public.encryption_keys
    WHERE id = 'profile_pii_key'
    LIMIT 1;
    
    IF encryption_key IS NULL THEN
      RAISE EXCEPTION 'Encryption key not found';
    END IF;
    
    -- Encrypt the password
    NEW.password_hash := encode(
      encrypt(
        convert_to(NEW.password_hash, 'utf8'),
        convert_to(encryption_key, 'utf8'),
        'aes'
      ),
      'base64'
    );
    NEW.encryption_key_id := 'profile_pii_key';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Revoke execute from public/anon
REVOKE EXECUTE ON FUNCTION public.encrypt_certificate_password() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_certificate_password() FROM anon;

-- 2. Attach trigger
DROP TRIGGER IF EXISTS trg_encrypt_cert_password ON public.fiscal_certificates;
CREATE TRIGGER trg_encrypt_cert_password
  BEFORE INSERT OR UPDATE OF password_hash ON public.fiscal_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_certificate_password();

-- 3. Create a SECURITY DEFINER function to decrypt password only for edge functions (server-side)
CREATE OR REPLACE FUNCTION public.get_certificate_password(cert_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_pw text;
  enc_key_id text;
  encryption_key text;
  owner_user_id uuid;
BEGIN
  -- Verify the caller owns this certificate
  SELECT fc.password_hash, fc.encryption_key_id, p.user_id
  INTO encrypted_pw, enc_key_id, owner_user_id
  FROM public.fiscal_certificates fc
  JOIN public.fiscal_issuers fi ON fi.id = fc.issuer_id
  JOIN public.profiles p ON p.id = fi.profile_id
  WHERE fc.id = cert_id;
  
  -- Only the certificate owner can decrypt
  IF owner_user_id IS NULL OR owner_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: you do not own this certificate';
  END IF;
  
  IF encrypted_pw IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF enc_key_id IS NULL THEN
    -- Not encrypted, return as-is (legacy)
    RETURN encrypted_pw;
  END IF;
  
  -- Get decryption key
  SELECT key_value INTO encryption_key
  FROM public.encryption_keys
  WHERE id = enc_key_id
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Decryption key not found';
  END IF;
  
  RETURN convert_from(
    decrypt(
      decode(encrypted_pw, 'base64'),
      convert_to(encryption_key, 'utf8'),
      'aes'
    ),
    'utf8'
  );
END;
$$;

-- Only authenticated users can call this
REVOKE EXECUTE ON FUNCTION public.get_certificate_password(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_certificate_password(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_certificate_password(uuid) TO authenticated;
