-- ============================================
-- LIMPEZA TOTAL: Auth + Profiles
-- Remove TODOS os usuários e identidades
-- ============================================

-- 1. Remover todas as identidades do Auth
DELETE FROM auth.identities;

-- 2. Remover todos os usuários do Auth
DELETE FROM auth.users;

-- 3. Garantir que profiles está vazio
DELETE FROM public.profiles;

-- 4. Verificar que tudo foi removido
SELECT 
  'auth.users' as tabela, COUNT(*)::text as registros FROM auth.users
UNION ALL
SELECT 'auth.identities', COUNT(*)::text FROM auth.identities
UNION ALL
SELECT 'public.profiles', COUNT(*)::text FROM public.profiles;