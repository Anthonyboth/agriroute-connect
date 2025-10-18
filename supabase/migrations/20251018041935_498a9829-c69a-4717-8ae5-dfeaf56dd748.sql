-- =============================================
-- CORREÇÃO EM CASCATA: Infraestrutura de Segurança
-- =============================================

-- =============================================
-- PARTE 1: Rate Limiting para Password Resets
-- =============================================

CREATE TABLE IF NOT EXISTS admin_password_reset_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reset_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  max_resets_per_hour integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(admin_profile_id)
);

ALTER TABLE admin_password_reset_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view own reset limits"
ON admin_password_reset_limits FOR SELECT
USING (admin_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "System manages reset limits"
ON admin_password_reset_limits FOR ALL
USING (true) WITH CHECK (true);

-- =============================================
-- PARTE 2: Sistema de Alertas de Segurança
-- =============================================

CREATE TABLE IF NOT EXISTS security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  admin_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_user_email text,
  details jsonb NOT NULL DEFAULT '{}',
  ip_address inet,
  user_agent text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_admin ON security_alerts(admin_profile_id) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_security_alerts_unresolved ON security_alerts(created_at DESC) WHERE NOT resolved;

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all security alerts"
ON security_alerts FOR SELECT
USING (is_admin());

CREATE POLICY "System creates security alerts"
ON security_alerts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins resolve security alerts"
ON security_alerts FOR UPDATE
USING (is_admin()) WITH CHECK (is_admin());

-- =============================================
-- PARTE 3: Funções de Validação e Rate Limiting
-- =============================================

-- Função: Validar Força de Senha
CREATE OR REPLACE FUNCTION validate_password_strength(password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  has_upper boolean;
  has_lower boolean;
  has_digit boolean;
  has_special boolean;
  length_ok boolean;
BEGIN
  length_ok := length(password) >= 12;
  has_upper := password ~ '[A-Z]';
  has_lower := password ~ '[a-z]';
  has_digit := password ~ '[0-9]';
  has_special := password ~ '[^A-Za-z0-9]';
  
  result := jsonb_build_object(
    'valid', length_ok AND has_upper AND has_lower AND has_digit AND has_special,
    'length_ok', length_ok,
    'has_uppercase', has_upper,
    'has_lowercase', has_lower,
    'has_digit', has_digit,
    'has_special', has_special,
    'min_length', 12,
    'message', CASE 
      WHEN NOT length_ok THEN 'Senha deve ter no mínimo 12 caracteres'
      WHEN NOT has_upper THEN 'Senha deve conter letra maiúscula'
      WHEN NOT has_lower THEN 'Senha deve conter letra minúscula'
      WHEN NOT has_digit THEN 'Senha deve conter número'
      WHEN NOT has_special THEN 'Senha deve conter caractere especial'
      ELSE 'Senha atende aos requisitos de segurança'
    END
  );
  
  RETURN result;
END;
$$;

-- Função: Verificar Rate Limit
CREATE OR REPLACE FUNCTION check_admin_reset_rate_limit(p_admin_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  max_count integer;
  window_start timestamptz;
  allowed boolean;
BEGIN
  SELECT reset_count, max_resets_per_hour, admin_password_reset_limits.window_start
  INTO current_count, max_count, window_start
  FROM admin_password_reset_limits
  WHERE admin_profile_id = p_admin_profile_id;
  
  IF NOT FOUND THEN
    INSERT INTO admin_password_reset_limits (admin_profile_id, reset_count)
    VALUES (p_admin_profile_id, 1);
    
    RETURN jsonb_build_object(
      'allowed', true, 'remaining', 4, 'reset_count', 1,
      'max_per_hour', 5, 'window_resets_at', now() + interval '1 hour'
    );
  END IF;
  
  IF window_start < now() - interval '1 hour' THEN
    UPDATE admin_password_reset_limits
    SET reset_count = 1, window_start = now(), updated_at = now()
    WHERE admin_profile_id = p_admin_profile_id;
    
    RETURN jsonb_build_object(
      'allowed', true, 'remaining', max_count - 1, 'reset_count', 1,
      'max_per_hour', max_count, 'window_resets_at', now() + interval '1 hour'
    );
  END IF;
  
  allowed := current_count < max_count;
  
  IF allowed THEN
    UPDATE admin_password_reset_limits
    SET reset_count = reset_count + 1, updated_at = now()
    WHERE admin_profile_id = p_admin_profile_id;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', allowed,
    'remaining', GREATEST(0, max_count - current_count - 1),
    'reset_count', current_count + CASE WHEN allowed THEN 1 ELSE 0 END,
    'max_per_hour', max_count,
    'window_resets_at', window_start + interval '1 hour',
    'rate_limited', NOT allowed
  );
END;
$$;

-- Função: Detectar Atividade Suspeita
CREATE OR REPLACE FUNCTION detect_suspicious_admin_activity(
  p_admin_profile_id uuid,
  p_activity_type text,
  p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_resets integer;
  alert_severity text;
BEGIN
  SELECT COUNT(*) INTO recent_resets
  FROM audit_logs
  WHERE user_id = p_admin_profile_id
    AND operation = 'PASSWORD_RESET_BY_ADMIN'
    AND timestamp > now() - interval '1 hour';
  
  IF recent_resets >= 10 THEN alert_severity := 'CRITICAL';
  ELSIF recent_resets >= 7 THEN alert_severity := 'HIGH';
  ELSIF recent_resets >= 5 THEN alert_severity := 'MEDIUM';
  ELSE alert_severity := 'LOW';
  END IF;
  
  IF recent_resets >= 5 THEN
    INSERT INTO security_alerts (
      alert_type, severity, admin_profile_id, details, ip_address
    ) VALUES (
      'EXCESSIVE_PASSWORD_RESETS', alert_severity, p_admin_profile_id,
      jsonb_build_object(
        'reset_count_last_hour', recent_resets,
        'activity_type', p_activity_type,
        'additional_details', p_details,
        'timestamp', now()
      ),
      inet_client_addr()
    );
  END IF;
END;
$$;

COMMENT ON TABLE admin_password_reset_limits IS 'Rate limiting para resets de senha por administradores (5 resets/hora)';
COMMENT ON TABLE security_alerts IS 'Alertas de atividade suspeita para monitoramento de segurança';
COMMENT ON FUNCTION validate_password_strength IS 'Valida força de senha: 12+ chars, maiúscula, minúscula, número, especial';
COMMENT ON FUNCTION check_admin_reset_rate_limit IS 'Verifica e aplica rate limit de 5 resets/hora por admin';
COMMENT ON FUNCTION detect_suspicious_admin_activity IS 'Detecta e alerta sobre atividade administrativa suspeita (5+ resets/hora)';