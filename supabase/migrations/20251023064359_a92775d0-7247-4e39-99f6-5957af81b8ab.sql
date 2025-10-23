-- Corrigir recursão infinita na função is_admin()
-- A função antiga consultava profiles, que por sua vez chamava is_admin() nas policies
-- Agora delegamos para has_role() que consulta user_roles (sem recursão)

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;