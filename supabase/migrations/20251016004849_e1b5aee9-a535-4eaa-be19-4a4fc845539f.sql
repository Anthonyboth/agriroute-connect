-- ============================================
-- MIGRAÇÃO DE SEGURANÇA CRÍTICA: user_roles
-- Implementa sistema de roles em tabela separada
-- CORRIGIDO: Mapeia user_role -> app_role corretamente
-- ============================================

-- 1. Criar tabela access_denied_logs para auditoria
CREATE TABLE IF NOT EXISTS access_denied_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  attempted_route text NOT NULL,
  required_roles text[] NOT NULL,
  user_roles text[] NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE access_denied_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access logs"
ON access_denied_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_access_denied_logs_user_id ON access_denied_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_denied_logs_created_at ON access_denied_logs(created_at DESC);

-- 2. Migrar dados mapeando user_role -> app_role

-- ADMIN -> admin
INSERT INTO user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM profiles p
WHERE p.role = 'ADMIN'::user_role
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = p.user_id AND ur.role = 'admin'::app_role
  );

-- PRODUTOR -> producer
INSERT INTO user_roles (user_id, role)
SELECT p.user_id, 'producer'::app_role
FROM profiles p
WHERE p.role = 'PRODUTOR'::user_role
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = p.user_id AND ur.role = 'producer'::app_role
  );

-- MOTORISTA e MOTORISTA_AFILIADO -> driver
INSERT INTO user_roles (user_id, role)
SELECT p.user_id, 'driver'::app_role
FROM profiles p
WHERE p.role IN ('MOTORISTA'::user_role, 'MOTORISTA_AFILIADO'::user_role)
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = p.user_id AND ur.role = 'driver'::app_role
  );

-- TRANSPORTADORA -> driver (empresa também é driver)
INSERT INTO user_roles (user_id, role)
SELECT p.user_id, 'driver'::app_role
FROM profiles p
WHERE p.role = 'TRANSPORTADORA'::user_role
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = p.user_id AND ur.role = 'driver'::app_role
  );

-- PRESTADOR_SERVICOS -> service_provider
INSERT INTO user_roles (user_id, role)
SELECT p.user_id, 'service_provider'::app_role
FROM profiles p
WHERE p.role = 'PRESTADOR_SERVICOS'::user_role
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = p.user_id AND ur.role = 'service_provider'::app_role
  );

-- 3. Criar função para verificar múltiplos roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- 4. Criar função helper para obter roles de um usuário
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE(role app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- 5. Atualizar trigger de audit para roles
DROP TRIGGER IF EXISTS audit_user_roles_changes ON user_roles;

CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_role_changes();

-- 6. Comentários para documentação
COMMENT ON TABLE access_denied_logs IS 'Logs de tentativas de acesso negado para auditoria de segurança';
COMMENT ON FUNCTION has_any_role IS 'Verifica se usuário tem pelo menos um dos roles especificados';
COMMENT ON FUNCTION get_user_roles IS 'Retorna todos os roles de um usuário';
COMMENT ON TABLE user_roles IS 'Tabela separada de roles para prevenir privilege escalation. Roles são verificados via funções SECURITY DEFINER';