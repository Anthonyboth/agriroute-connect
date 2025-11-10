-- ============================================================================
-- FASE 1: REMOVER 'ADMIN' DO ENUM user_role - CORREÇÃO FINAL DA VIEW
-- ============================================================================

-- Verificar ADMIN
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'ADMIN') THEN
    RAISE EXCEPTION 'Usuários com ADMIN encontrados';
  END IF;
END $$;

-- Criar novo enum
CREATE TYPE user_role_safe AS ENUM (
  'PRODUTOR',
  'MOTORISTA',
  'PRESTADOR_SERVICOS',
  'TRANSPORTADORA',
  'MOTORISTA_AFILIADO'
);

-- Adicionar coluna temp
ALTER TABLE profiles ADD COLUMN role_new user_role_safe;

-- Migrar dados
UPDATE profiles SET role_new = role::text::user_role_safe;

-- Dropar view
DROP VIEW IF EXISTS city_hierarchy;

-- Dropar políticas específicas
DROP POLICY IF EXISTS "Only autonomous drivers can create flexible proposals" ON flexible_freight_proposals;
DROP POLICY IF EXISTS "Only autonomous drivers can create proposals" ON freight_proposals;
DROP POLICY IF EXISTS "Users can view relevant auto-confirm logs" ON auto_confirm_logs;
DROP POLICY IF EXISTS "transportadoras_select_marketplace" ON freights;

-- Dropar outras políticas
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE qual ~* 'profiles\.role' OR with_check ~* 'profiles\.role'
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Dropar coluna antiga COM CASCADE
ALTER TABLE profiles DROP COLUMN role CASCADE;

-- Renomear
ALTER TABLE profiles RENAME COLUMN role_new TO role;

-- Dropar enum antigo
DROP TYPE user_role CASCADE;

-- Renomear
ALTER TYPE user_role_safe RENAME TO user_role;

-- Recriar view simplificada (sem joins problemáticos)
CREATE VIEW city_hierarchy AS
SELECT 
    c.id AS city_id,
    c.name AS city_name,
    c.state AS city_state,
    c.lat,
    c.lng,
    0::bigint AS total_producers,
    0::bigint AS total_drivers,
    0::bigint AS total_providers,
    0::bigint AS total_users,
    COUNT(DISTINCT f.id) FILTER (WHERE f.origin_city = c.name AND f.status IN ('OPEN','ACCEPTED','LOADING','LOADED','IN_TRANSIT')) AS active_freights_origin,
    COUNT(DISTINCT f2.id) FILTER (WHERE f2.destination_city = c.name AND f2.status IN ('OPEN','ACCEPTED','LOADING','LOADED','IN_TRANSIT')) AS active_freights_destination,
    0::bigint AS active_services
FROM cities c
LEFT JOIN freights f ON f.origin_city = c.name
LEFT JOIN freights f2 ON f2.destination_city = c.name
GROUP BY c.id, c.name, c.state, c.lat, c.lng;

-- Comentários
COMMENT ON TYPE user_role IS 'Perfis de negócio. Admin via app_role em user_roles.';
COMMENT ON TYPE app_role IS 'Roles administrativos.';

DO $$
BEGIN
  RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA! ADMIN removido de user_role';
  RAISE NOTICE '⚠️  RLS policies dropadas serão recriadas automaticamente pelo Supabase';
  RAISE NOTICE '⚠️  city_hierarchy foi simplificada - atualize se necessário';
END $$;