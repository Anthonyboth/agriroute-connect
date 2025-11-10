-- Criar tabela de auditoria para correção de roles
CREATE TABLE IF NOT EXISTS public.role_correction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  correction_reason TEXT NOT NULL,
  corrected_by TEXT NOT NULL, -- 'SYSTEM' ou user_id do admin
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.role_correction_audit ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para auditoria
CREATE POLICY "Admins can view all audit logs"
  ON public.role_correction_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit logs"
  ON public.role_correction_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (corrected_by = 'SYSTEM' OR public.has_role(auth.uid(), 'admin'::app_role));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_role_correction_audit_user_id ON public.role_correction_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_role_correction_audit_created_at ON public.role_correction_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_correction_audit_profile_id ON public.role_correction_audit(profile_id);

-- Função RPC para buscar tentativas de login falhadas
CREATE OR REPLACE FUNCTION public.get_failed_login_attempts(
  since_timestamp TIMESTAMP WITH TIME ZONE,
  min_failures INTEGER DEFAULT 3
)
RETURNS TABLE (
  email TEXT,
  failed_count BIGINT,
  ip_addresses TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(al.email, al.payload->>'email') as email,
    COUNT(*) as failed_count,
    ARRAY_AGG(DISTINCT al.ip_address) as ip_addresses
  FROM auth.audit_log_entries al
  WHERE 
    al.created_at >= since_timestamp
    AND al.action = 'login'
    AND al.error_message IS NOT NULL
  GROUP BY COALESCE(al.email, al.payload->>'email')
  HAVING COUNT(*) >= min_failures
  ORDER BY failed_count DESC;
END;
$$;

-- Função RPC para buscar logins com múltiplos IPs
CREATE OR REPLACE FUNCTION public.get_multiple_ip_logins(
  since_timestamp TIMESTAMP WITH TIME ZONE,
  min_ip_count INTEGER DEFAULT 3
)
RETURNS TABLE (
  email TEXT,
  ip_count BIGINT,
  ip_addresses TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(al.email, al.payload->>'email') as email,
    COUNT(DISTINCT al.ip_address) as ip_count,
    ARRAY_AGG(DISTINCT al.ip_address) as ip_addresses
  FROM auth.audit_log_entries al
  WHERE 
    al.created_at >= since_timestamp
    AND al.action = 'login'
    AND al.error_message IS NULL
  GROUP BY COALESCE(al.email, al.payload->>'email')
  HAVING COUNT(DISTINCT al.ip_address) >= min_ip_count
  ORDER BY ip_count DESC;
END;
$$;

-- Função RPC para buscar logins em horários incomuns
CREATE OR REPLACE FUNCTION public.get_unusual_hour_logins(
  since_timestamp TIMESTAMP WITH TIME ZONE,
  start_hour INTEGER DEFAULT 2,
  end_hour INTEGER DEFAULT 6
)
RETURNS TABLE (
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  hour_of_day INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(al.email, al.payload->>'email') as email,
    al.created_at,
    al.ip_address,
    EXTRACT(HOUR FROM al.created_at AT TIME ZONE 'America/Sao_Paulo')::INTEGER as hour_of_day
  FROM auth.audit_log_entries al
  WHERE 
    al.created_at >= since_timestamp
    AND al.action = 'login'
    AND al.error_message IS NULL
    AND EXTRACT(HOUR FROM al.created_at AT TIME ZONE 'America/Sao_Paulo')::INTEGER >= start_hour
    AND EXTRACT(HOUR FROM al.created_at AT TIME ZONE 'America/Sao_Paulo')::INTEGER < end_hour
  ORDER BY al.created_at DESC;
END;
$$;

-- Script de validação pós-migração para verificar roles
CREATE OR REPLACE FUNCTION public.validate_roles_post_migration()
RETURNS TABLE (
  validation_status TEXT,
  invalid_profiles_count BIGINT,
  invalid_profiles JSONB,
  admin_in_user_roles_count BIGINT,
  recommendations TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_roles TEXT[] := ARRAY['PRODUTOR', 'MOTORISTA', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA', 'MOTORISTA_AFILIADO'];
  invalid_count BIGINT;
  admin_count BIGINT;
  invalid_data JSONB;
BEGIN
  -- Contar profiles com roles inválidas
  SELECT COUNT(*), 
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', id,
           'email', email,
           'role', role,
           'created_at', created_at
         )), '[]'::jsonb)
  INTO invalid_count, invalid_data
  FROM profiles
  WHERE role IS NOT NULL
    AND role NOT IN (SELECT unnest(valid_roles));

  -- Contar usuários com roles administrativas em user_roles
  SELECT COUNT(*)
  INTO admin_count
  FROM user_roles
  WHERE role IN ('admin', 'moderator');

  -- Retornar resultado da validação
  RETURN QUERY
  SELECT 
    CASE 
      WHEN invalid_count = 0 THEN 'PASSED'
      ELSE 'FAILED'
    END as validation_status,
    invalid_count as invalid_profiles_count,
    invalid_data as invalid_profiles,
    admin_count as admin_in_user_roles_count,
    CASE 
      WHEN invalid_count > 0 THEN 
        'AÇÃO NECESSÁRIA: Encontrados ' || invalid_count || ' profiles com roles inválidas. Execute auto-correct-invalid-roles para corrigir.'
      ELSE 
        'Sistema OK: Todas as roles estão válidas. ' || admin_count || ' usuários com permissões administrativas em user_roles.'
    END as recommendations;
END;
$$;

COMMENT ON FUNCTION public.validate_roles_post_migration() IS 'Valida que roles administrativos estão apenas em user_roles e não em profiles';

-- Configurar cron jobs
SELECT cron.schedule(
  'send-delivery-deadline-notifications-hourly',
  '0 * * * *', -- A cada hora
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/send-delivery-deadline-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'auto-correct-invalid-roles-daily',
  '0 3 * * *', -- Diariamente às 3h da manhã
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/auto-correct-invalid-roles',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'monitor-suspicious-logins-hourly',
  '30 * * * *', -- A cada hora, aos 30 minutos
  $$
  SELECT
    net.http_post(
        url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-suspicious-logins',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
