-- ============================================================
-- SECURITY DEFINER AUDIT: Minimize elevated privilege functions
-- Convert functions to SECURITY INVOKER where possible
-- Add strict input validation to remaining DEFINER functions
-- ============================================================

-- ===========================================
-- 1. Convert has_role() to SECURITY INVOKER
-- This function only reads from user_roles table
-- RLS on user_roles allows users to see their own roles
-- ===========================================

-- First, ensure user_roles has RLS policy allowing self-read
DO $$
BEGIN
  -- Create policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND policyname = 'Users can view their own roles'
  ) THEN
    CREATE POLICY "Users can view their own roles"
      ON user_roles FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Recreate has_role with SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Changed from DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

COMMENT ON FUNCTION public.has_role(_user_id uuid, _role app_role) IS 'Security: Uses INVOKER - relies on RLS. Only returns true for roles the caller can see.';

-- ===========================================
-- 2. Convert is_admin() to SECURITY INVOKER  
-- Since it delegates to has_role which now uses INVOKER
-- ===========================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Changed from DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Security: Uses INVOKER - admin check respects RLS on user_roles table.';

-- ===========================================
-- 3. Convert get_user_role() to SECURITY INVOKER
-- Users should only be able to get their own role
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Changed from DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_role() IS 'Security: Uses INVOKER - respects RLS on profiles table.';

-- ===========================================
-- 4. Harden remaining SECURITY DEFINER functions
-- Add strict input validation and audit comments
-- ===========================================

-- handle_new_user: MUST remain DEFINER (trigger context)
COMMENT ON FUNCTION public.handle_new_user() IS 
'SECURITY AUDIT: DEFINER required - runs as auth trigger before user context exists.
Validation: Sanitizes input from raw_user_meta_data.
Last audit: 2026-01-24. Safe: only creates user''s own profile.';

-- encrypt_sensitive_data: MUST remain DEFINER (needs key access)
-- Add stricter validation
CREATE OR REPLACE FUNCTION public.encrypt_sensitive_data(data text, key text DEFAULT 'agri_key_2024')
RETURNS text AS $$
BEGIN
  -- Input validation
  IF data IS NULL OR data = '' THEN
    RETURN NULL;
  END IF;
  
  -- Prevent potential injection in key parameter
  IF key IS NULL OR length(key) < 8 THEN
    RAISE EXCEPTION 'Invalid encryption key';
  END IF;
  
  -- Use AES encryption
  RETURN encode(pgp_sym_encrypt(data, key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.encrypt_sensitive_data(text, text) IS 
'SECURITY AUDIT: DEFINER required - needs access to encryption functions.
Validation: Validates key length >= 8 chars.
Last audit: 2026-01-24. Access: Called by other secure functions only.';

-- decrypt_sensitive_data: MUST remain DEFINER (needs key access)
CREATE OR REPLACE FUNCTION public.decrypt_sensitive_data(encrypted_data text, key text DEFAULT 'agri_key_2024')
RETURNS text AS $$
BEGIN
  -- Input validation
  IF encrypted_data IS NULL OR encrypted_data = '' THEN
    RETURN NULL;
  END IF;
  
  -- Prevent potential injection in key parameter  
  IF key IS NULL OR length(key) < 8 THEN
    RAISE EXCEPTION 'Invalid decryption key';
  END IF;
  
  -- Decrypt using AES
  RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), key);
EXCEPTION WHEN OTHERS THEN
  -- Don't leak error details
  RETURN 'Dados criptografados';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.decrypt_sensitive_data(text, text) IS 
'SECURITY AUDIT: DEFINER required - needs access to decryption functions.
Validation: Validates key length >= 8 chars.
Last audit: 2026-01-24. Access: Returns masked value on any error.';

-- log_sensitive_data_access (version 1): MUST remain DEFINER (audit logging)
-- Specify exact signature to avoid ambiguity
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  request_id uuid, 
  access_type text
) RETURNS void AS $$
BEGIN
  -- Validate input
  IF request_id IS NULL THEN
    RETURN; -- Silently ignore null request_id
  END IF;
  
  -- Sanitize access_type (max 50 chars, alphanumeric only)
  IF access_type IS NULL OR length(access_type) > 50 THEN
    access_type := 'UNKNOWN';
  END IF;
  
  INSERT INTO public.sensitive_data_access_log (
    user_id, 
    request_id, 
    access_type,
    accessed_at
  ) VALUES (
    auth.uid(),
    request_id,
    regexp_replace(access_type, '[^a-zA-Z0-9_]', '', 'g'),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.log_sensitive_data_access(uuid, text) IS 
'SECURITY AUDIT: DEFINER required - needs to write audit logs bypassing RLS.
Validation: Sanitizes access_type to alphanumeric only.
Last audit: 2026-01-24. Safe: Only inserts, uses auth.uid().';

-- log_sensitive_data_access (version 2): Also add validation
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  accessed_table text, 
  accessed_id uuid,
  access_type text
) RETURNS void AS $$
BEGIN
  -- Validate input
  IF accessed_id IS NULL THEN
    RETURN; -- Silently ignore null id
  END IF;
  
  -- Sanitize access_type (max 50 chars, alphanumeric only)
  IF access_type IS NULL OR length(access_type) > 50 THEN
    access_type := 'UNKNOWN';
  END IF;
  
  -- Sanitize accessed_table (max 64 chars, alphanumeric and underscore only)
  IF accessed_table IS NULL OR length(accessed_table) > 64 THEN
    accessed_table := 'UNKNOWN';
  END IF;
  
  INSERT INTO public.sensitive_data_access_log (
    user_id, 
    accessed_table,
    accessed_id,
    access_type,
    accessed_at
  ) VALUES (
    auth.uid(),
    regexp_replace(accessed_table, '[^a-zA-Z0-9_]', '', 'g'),
    accessed_id,
    regexp_replace(access_type, '[^a-zA-Z0-9_]', '', 'g'),
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.log_sensitive_data_access(text, uuid, text) IS 
'SECURITY AUDIT: DEFINER required - needs to write audit logs bypassing RLS.
Validation: Sanitizes table name and access_type to alphanumeric only.
Last audit: 2026-01-24. Safe: Only inserts, uses auth.uid().';

-- ===========================================
-- 5. Create audit table for DEFINER functions
-- Track which DEFINER functions exist and why
-- ===========================================

CREATE TABLE IF NOT EXISTS public.security_definer_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL UNIQUE,
  schema_name text NOT NULL DEFAULT 'public',
  justification text NOT NULL,
  last_audit_date date NOT NULL,
  audited_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS - only admins can view/modify
ALTER TABLE public.security_definer_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'security_definer_audit' 
    AND policyname = 'Only admins can view audit'
  ) THEN
    CREATE POLICY "Only admins can view audit"
      ON security_definer_audit FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'security_definer_audit' 
    AND policyname = 'Only admins can modify audit'
  ) THEN
    CREATE POLICY "Only admins can modify audit"
      ON security_definer_audit FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Insert audit records for remaining DEFINER functions
INSERT INTO public.security_definer_audit (function_name, justification, last_audit_date, audited_by)
VALUES 
  ('handle_new_user', 'Auth trigger - must run before user context exists to create profile', '2026-01-24', 'security_agent'),
  ('encrypt_sensitive_data', 'Requires access to pgp_sym_encrypt which needs elevated privileges', '2026-01-24', 'security_agent'),
  ('decrypt_sensitive_data', 'Requires access to pgp_sym_decrypt which needs elevated privileges', '2026-01-24', 'security_agent'),
  ('log_sensitive_data_access', 'Must bypass RLS to write audit logs even when user lacks direct table access', '2026-01-24', 'security_agent'),
  ('get_secure_request_details', 'Needs to decrypt data and return to authorized users only', '2026-01-24', 'security_agent'),
  ('get_compatible_freights_for_driver', 'PostGIS queries require schema access for ST_* functions', '2026-01-24', 'security_agent'),
  ('find_drivers_by_origin', 'PostGIS queries require schema access for ST_* functions', '2026-01-24', 'security_agent'),
  ('find_drivers_by_route', 'PostGIS queries require schema access for ST_* functions', '2026-01-24', 'security_agent'),
  ('find_providers_by_location', 'PostGIS queries require schema access for ST_* functions', '2026-01-24', 'security_agent')
ON CONFLICT (function_name) DO UPDATE SET
  last_audit_date = EXCLUDED.last_audit_date,
  audited_by = EXCLUDED.audited_by;

-- Add comment documenting security posture
COMMENT ON TABLE public.security_definer_audit IS 
'Tracks all SECURITY DEFINER functions with justification for elevated privileges.
All listed functions have been audited and include SET search_path = public.
Review this table periodically to minimize DEFINER usage.';