-- =============================================================================
-- SECURITY FIX: Hardening de funções SECURITY DEFINER - DROP antes de recriar
-- =============================================================================

-- 1. Drop e recriar encrypt_sensitive_data com SET search_path
DROP FUNCTION IF EXISTS public.encrypt_sensitive_data(text, text);

CREATE FUNCTION public.encrypt_sensitive_data(data text, key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF data IS NULL OR key IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF length(data) > 10000 OR length(key) > 256 THEN
    RAISE EXCEPTION 'Input too long for encryption';
  END IF;
  
  RETURN encode(encrypt(convert_to(data, 'UTF8'), convert_to(key, 'UTF8'), 'aes'), 'base64');
END;
$$;

-- 2. Drop e recriar decrypt_sensitive_data com SET search_path
DROP FUNCTION IF EXISTS public.decrypt_sensitive_data(text, text);

CREATE FUNCTION public.decrypt_sensitive_data(data text, key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF data IS NULL OR key IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF length(data) > 20000 OR length(key) > 256 THEN
    RAISE EXCEPTION 'Input too long for decryption';
  END IF;
  
  RETURN convert_from(decrypt(decode(data, 'base64'), convert_to(key, 'UTF8'), 'aes'), 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 3. REVOGAR acesso público às funções de criptografia
REVOKE ALL ON FUNCTION public.encrypt_sensitive_data(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decrypt_sensitive_data(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encrypt_sensitive_data(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive_data(text, text) TO authenticated;

-- =============================================================================
-- SECURITY FIX: Hardening de profiles_encrypted_data
-- A tabela usa 'id' (profile_id) como FK para profiles.id
-- =============================================================================

REVOKE ALL ON TABLE public.profiles_encrypted_data FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles_encrypted_data TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "pii_select_own" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_insert_own" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_update_own" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_delete_own" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_select_own_strict" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_insert_own_strict" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_update_own_strict" ON public.profiles_encrypted_data;
DROP POLICY IF EXISTS "pii_delete_own_strict" ON public.profiles_encrypted_data;

-- Helper function to get profile id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_my_profile_id_for_pii()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Políticas restritivas usando helper function
CREATE POLICY "pii_select_own_strict" 
ON public.profiles_encrypted_data 
FOR SELECT 
TO authenticated
USING (id = public.get_my_profile_id_for_pii());

CREATE POLICY "pii_insert_own_strict" 
ON public.profiles_encrypted_data 
FOR INSERT 
TO authenticated
WITH CHECK (id = public.get_my_profile_id_for_pii());

CREATE POLICY "pii_update_own_strict" 
ON public.profiles_encrypted_data 
FOR UPDATE 
TO authenticated
USING (id = public.get_my_profile_id_for_pii())
WITH CHECK (id = public.get_my_profile_id_for_pii());

CREATE POLICY "pii_delete_own_strict" 
ON public.profiles_encrypted_data 
FOR DELETE 
TO authenticated
USING (id = public.get_my_profile_id_for_pii());

-- =============================================================================
-- SECURITY FIX: Hardening de driver_stripe_accounts
-- =============================================================================

REVOKE ALL ON TABLE public.driver_stripe_accounts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.driver_stripe_accounts TO authenticated;

DROP POLICY IF EXISTS "driver_stripe_select_own" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_update_own" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_insert_own" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "Drivers can view their own stripe accounts" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "Drivers can update their own stripe accounts" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "Drivers can insert their own stripe accounts" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_select_own_only" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_insert_own_only" ON public.driver_stripe_accounts;
DROP POLICY IF EXISTS "driver_stripe_update_own_only" ON public.driver_stripe_accounts;

-- driver_id na tabela referencia profile.id (não auth.uid())
CREATE POLICY "driver_stripe_select_own_only" 
ON public.driver_stripe_accounts 
FOR SELECT 
TO authenticated
USING (driver_id = public.get_my_profile_id_for_pii());

CREATE POLICY "driver_stripe_insert_own_only" 
ON public.driver_stripe_accounts 
FOR INSERT 
TO authenticated
WITH CHECK (driver_id = public.get_my_profile_id_for_pii());

CREATE POLICY "driver_stripe_update_own_only" 
ON public.driver_stripe_accounts 
FOR UPDATE 
TO authenticated
USING (driver_id = public.get_my_profile_id_for_pii())
WITH CHECK (driver_id = public.get_my_profile_id_for_pii());

-- =============================================================================
-- SECURITY FIX: Audit table para rastrear tentativas de acesso
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.encrypted_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accessor_user_id uuid NOT NULL,
  accessed_profile_id uuid,
  access_type text NOT NULL,
  table_name text NOT NULL,
  ip_address inet,
  user_agent text,
  success boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encrypted_data_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encrypted_access_log_admin_only" ON public.encrypted_data_access_log;
CREATE POLICY "encrypted_access_log_admin_only" 
ON public.encrypted_data_access_log 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() AND role = 'admin'
  )
);

REVOKE ALL ON TABLE public.encrypted_data_access_log FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.encrypted_data_access_log TO authenticated;

CREATE INDEX IF NOT EXISTS idx_encrypted_access_log_accessor ON public.encrypted_data_access_log(accessor_user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_access_log_created ON public.encrypted_data_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_encrypted_access_log_type ON public.encrypted_data_access_log(access_type);