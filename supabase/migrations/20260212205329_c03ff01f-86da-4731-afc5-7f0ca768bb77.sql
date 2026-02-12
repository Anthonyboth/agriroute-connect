-- Restaurar GRANT SELECT na tabela profiles para authenticated e anon
-- A segurança é gerenciada pelas RLS policies, não pela remoção de GRANTs
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Também garantir que a view profiles_secure tenha os grants corretos
GRANT SELECT ON public.profiles_secure TO authenticated;
GRANT SELECT ON public.profiles_secure TO anon;