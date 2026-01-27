-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA: Remover chave hardcoded de criptografia
-- Remove DEFAULT 'agri_key_2024' e usa tabela encryption_keys
-- ============================================================

-- Recriar encrypt_sensitive_data usando chave da tabela (sem hardcode)
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Buscar chave da tabela segura (acesso via SECURITY DEFINER)
  SELECT key_value INTO encryption_key
  FROM public.encryption_keys
  WHERE id = 'profile_pii_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found. Configure encryption_keys table.';
  END IF;
  
  RETURN encode(
    encrypt(
      convert_to(data, 'utf8'),
      convert_to(encryption_key, 'utf8'),
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Recriar decrypt_sensitive_data usando chave da tabela (sem hardcode)
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Buscar chave da tabela segura (acesso via SECURITY DEFINER)
  SELECT key_value INTO encryption_key
  FROM public.encryption_keys
  WHERE id = 'profile_pii_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found. Configure encryption_keys table.';
  END IF;
  
  RETURN convert_from(
    decrypt(
      decode(encrypted_data, 'base64'),
      convert_to(encryption_key, 'utf8'),
      'aes'
    ),
    'utf8'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Se falhar decriptação, retorna NULL (dado pode estar corrompido ou chave errada)
    RETURN NULL;
END;
$$;

-- Garantir que apenas service_role pode acessar encryption_keys
REVOKE ALL ON public.encryption_keys FROM anon, authenticated;

-- Comentário de auditoria
COMMENT ON FUNCTION public.encrypt_sensitive_data(text) IS 
'[SECURITY] Criptografa dados sensíveis usando chave AES-256 da tabela encryption_keys. Chave hardcoded removida em 2026-01-27.';

COMMENT ON FUNCTION public.decrypt_sensitive_data(text) IS 
'[SECURITY] Descriptografa dados usando chave AES-256 da tabela encryption_keys. Chave hardcoded removida em 2026-01-27.';