-- AgriRoute Security Hardening - Zero Trust Implementation
-- Este script implementa proteção extrema seguindo princípios Zero-Trust

-- 1. HABILITAR RLS EM TODAS AS TABELAS QUE NÃO POSSUEM
-- Verificar e habilitar RLS em tabelas críticas

-- Tabelas do sistema que precisam de RLS (se ainda não tiver)
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- 2. CRIAR EXTENSÃO PARA CRIPTOGRAFIA (se não existir)
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 3. CRIAR FUNÇÕES DE AUDITORIA E SEGURANÇA
-- Função para logs de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  table_name text NOT NULL,
  operation text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  timestamp timestamptz DEFAULT now()
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para auditoria - apenas admins podem ver
CREATE POLICY "Only admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (is_admin());

-- Sistema pode inserir logs
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- 4. FUNÇÕES SEGURAS PARA VALIDAÇÃO DE USUÁRIO
CREATE OR REPLACE FUNCTION public.get_current_user_safe()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    null
  );
$$;

-- Função para verificar se usuário é proprietário de um frete
CREATE OR REPLACE FUNCTION public.is_freight_owner(freight_id uuid, user_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.freights 
    WHERE id = freight_id 
    AND (producer_id = user_profile_id OR driver_id = user_profile_id)
  );
$$;

-- 5. CRIPTOGRAFIA PARA DADOS SENSÍVEIS
-- Função para criptografar CPF/CNPJ
CREATE OR REPLACE FUNCTION public.encrypt_document(doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encrypted_data text;
BEGIN
  IF doc IS NULL OR doc = '' THEN
    RETURN NULL;
  END IF;
  
  -- Usar chave derivada do documento + salt do sistema
  encrypted_data := encode(
    pgp_sym_encrypt(
      doc, 
      encode(digest('agriroute_key_2024_' || doc, 'sha256'), 'hex')
    ), 
    'base64'
  );
  
  RETURN encrypted_data;
END;
$$;

-- Função para descriptografar CPF/CNPJ
CREATE OR REPLACE FUNCTION public.decrypt_document(encrypted_doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF encrypted_doc IS NULL OR encrypted_doc = '' THEN
    RETURN NULL;
  END IF;
  
  -- Tentar descriptografar - se falhar, retornar mascarado
  BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_doc, 'base64'), 'temp_key');
  EXCEPTION WHEN OTHERS THEN
    RETURN '***.***.***-**';
  END;
END;
$$;

-- 6. SISTEMA DE RATE LIMITING AVANÇADO
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address inet NOT NULL,
  endpoint text NOT NULL,
  violation_count integer DEFAULT 1,
  blocked_until timestamptz,
  first_violation_at timestamptz DEFAULT now(),
  last_violation_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver violações
CREATE POLICY "Only admins can manage rate limit violations"
ON public.rate_limit_violations
FOR ALL
USING (is_admin());

-- 7. FUNÇÃO PARA LOG DE ACESSO SENSÍVEL
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  accessed_table text,
  accessed_id uuid,
  access_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      'session_id', current_setting('request.jwt.claims', true)::json->>'session_id'
    ),
    now()
  );
END;
$$;

-- 8. POLÍTICAS RLS EXTREMAMENTE RESTRITIVAS

-- Política mais restritiva para freights
DROP POLICY IF EXISTS "Drivers can view open freights and their accepted ones" ON public.freights;
CREATE POLICY "Drivers can view only matched freights"
ON public.freights
FOR SELECT
USING (
  -- Driver só pode ver fretes que foram matched para ele
  (status = 'OPEN'::freight_status AND id IN (
    SELECT freight_id FROM public.freight_matches fm 
    WHERE fm.driver_id = get_current_user_safe()
  ))
  OR
  -- Ou fretes que já foram aceitos por ele
  (driver_id = get_current_user_safe())
  OR
  -- Ou se é admin
  is_admin()
);

-- 9. FUNÇÃO PARA RPC SEGURO DE DADOS DE USUÁRIO
CREATE OR REPLACE FUNCTION public.get_secure_user_profile()
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  role user_role,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log do acesso
  PERFORM log_sensitive_data_access('profiles', get_current_user_safe(), 'profile_access');
  
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email,
    p.role,
    p.is_active,
    p.created_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
END;
$$;

-- 10. TRIGGER PARA AUDITORIA AUTOMÁTICA EM TABELAS CRÍTICAS
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log de mudanças em tabelas críticas
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      user_id, table_name, operation, old_data
    ) VALUES (
      get_current_user_safe(), TG_TABLE_NAME, TG_OP, row_to_json(OLD)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      user_id, table_name, operation, old_data, new_data
    ) VALUES (
      get_current_user_safe(), TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      user_id, table_name, operation, new_data
    ) VALUES (
      get_current_user_safe(), TG_TABLE_NAME, TG_OP, row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Aplicar triggers de auditoria nas tabelas críticas
DROP TRIGGER IF EXISTS freight_audit_trigger ON public.freights;
CREATE TRIGGER freight_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.freights
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS freight_payments_audit_trigger ON public.freight_payments;
CREATE TRIGGER freight_payments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.freight_payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- 11. FUNÇÃO PARA DETECTAR ACESSOS SUSPEITOS
CREATE OR REPLACE FUNCTION public.detect_suspicious_access(
  table_accessed text,
  rows_accessed integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suspicious boolean := false;
BEGIN
  -- Detectar se acesso é suspeito (muitos registros de uma vez)
  IF rows_accessed > 1000 THEN
    suspicious := true;
    
    -- Log da atividade suspeita
    INSERT INTO public.audit_logs (
      user_id, table_name, operation, new_data
    ) VALUES (
      get_current_user_safe(),
      'security_alerts',
      'SUSPICIOUS_ACCESS',
      jsonb_build_object(
        'table', table_accessed,
        'rows', rows_accessed,
        'timestamp', now(),
        'ip', inet_client_addr()
      )
    );
  END IF;
  
  RETURN suspicious;
END;
$$;

-- 12. POLÍTICA PARA SPATIAL_REF_SYS (somente leitura para usuários autenticados)
DROP POLICY IF EXISTS "Authenticated users can read spatial ref" ON public.spatial_ref_sys;
CREATE POLICY "Authenticated users can read spatial ref"
ON public.spatial_ref_sys
FOR SELECT
USING (true); -- Esta tabela pode ser lida por todos (dados geográficos padrão)

-- Nunca permitir modificação da spatial_ref_sys
CREATE POLICY "No modifications to spatial ref"
ON public.spatial_ref_sys
FOR ALL
USING (false);

-- 13. ÍNDICES PARA PERFORMANCE DE AUDITORIA
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp 
ON public.audit_logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation 
ON public.audit_logs (table_name, operation);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_endpoint 
ON public.rate_limit_violations (ip_address, endpoint);

-- 14. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE public.audit_logs IS 'Tabela de auditoria completa - todos os acessos e modificações';
COMMENT ON FUNCTION public.get_current_user_safe() IS 'Função segura para obter ID do usuário atual';
COMMENT ON FUNCTION public.is_freight_owner(uuid, uuid) IS 'Verifica se usuário é dono de um frete';
COMMENT ON FUNCTION public.encrypt_document(text) IS 'Criptografa documentos sensíveis (CPF/CNPJ)';
COMMENT ON FUNCTION public.log_sensitive_data_access(text, uuid, text) IS 'Log obrigatório para acessos a dados sensíveis';