-- ✅ FASE 1: Criar índices para otimizar performance do fetchProfile

-- Índice na coluna user_id da tabela profiles (acelera query principal)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON profiles(user_id);

-- Índice na coluna user_id da tabela user_roles (acelera busca de roles)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);

-- Analisar tabelas para atualizar estatísticas do query planner
ANALYZE profiles;
ANALYZE user_roles;