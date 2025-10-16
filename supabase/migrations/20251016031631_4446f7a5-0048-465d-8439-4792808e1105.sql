-- Sprint 1 - Parte 2: Correções Finais de Segurança
-- Corrigir funções restantes e views com Security Definer

-- Identificar e corrigir funções que ainda faltam search_path
-- Baseado nos warnings do linter, há 4 funções restantes

-- 1. Função encrypt_document (adicionar search_path)
CREATE OR REPLACE FUNCTION public.encrypt_document(doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  encrypted_data text;
  encryption_key text;
BEGIN
  IF doc IS NULL OR doc = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := encode(digest('agriroute_key_2024_' || doc || '_salt', 'sha256'), 'hex');
  
  encrypted_data := encode(
    pgp_sym_encrypt(doc, encryption_key), 
    'base64'
  );
  
  RETURN encrypted_data;
END;
$function$;

-- 2. Função decrypt_document (adicionar search_path)
CREATE OR REPLACE FUNCTION public.decrypt_document(encrypted_doc text, original_doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  IF encrypted_doc IS NULL OR encrypted_doc = '' THEN
    RETURN '***.***.***-**';
  END IF;
  
  IF NOT is_admin() THEN
    RETURN '***.***.***-**';
  END IF;
  
  BEGIN
    encryption_key := encode(digest('agriroute_key_2024_' || original_doc || '_salt', 'sha256'), 'hex');
    RETURN pgp_sym_decrypt(decode(encrypted_doc, 'base64'), encryption_key);
  EXCEPTION WHEN OTHERS THEN
    RETURN '***.***.***-**';
  END;
END;
$function$;

-- 3. Função is_ip_blacklisted (já tem search_path mas vamos garantir)
CREATE OR REPLACE FUNCTION public.is_ip_blacklisted(check_ip inet)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.security_blacklist
    WHERE ip_address = check_ip
    AND (blocked_until IS NULL OR blocked_until > now())
  );
$function$;

-- 4. Função log_sensitive_data_access (garantir search_path)
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(accessed_table text, accessed_id uuid, access_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    table_name,
    operation,
    new_data,
    timestamp
  ) VALUES (
    get_current_user_safe(),
    accessed_table,
    access_type,
    jsonb_build_object(
      'accessed_id', accessed_id,
      'timestamp', now(),
      'ip_address', inet_client_addr()
    ),
    now()
  );
END;
$function$;

-- Identificar views com SECURITY DEFINER e documentar
-- (Views com SECURITY DEFINER precisam ser recriadas sem essa propriedade)
DO $$
DECLARE
  view_rec RECORD;
BEGIN
  FOR view_rec IN 
    SELECT schemaname, viewname 
    FROM pg_views 
    WHERE schemaname = 'public'
    AND (definition ILIKE '%SECURITY DEFINER%' OR definition ILIKE '%security definer%')
  LOOP
    RAISE NOTICE 'View com SECURITY DEFINER detectado: %.%', view_rec.schemaname, view_rec.viewname;
    RAISE NOTICE 'AÇÃO NECESSÁRIA: Revisar e recriar esta view sem SECURITY DEFINER';
  END LOOP;
END $$;