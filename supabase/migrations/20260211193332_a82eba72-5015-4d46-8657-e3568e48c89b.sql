-- Fix: Criar função SECURITY DEFINER para verificar participação em serviços
-- Isso evita recursão infinita entre profiles RLS ↔ service_requests RLS

CREATE OR REPLACE FUNCTION public.is_service_participant(target_profile_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE (
      (sr.client_id = target_profile_id AND sr.provider_id = get_my_profile_id())
      OR
      (sr.provider_id = target_profile_id AND sr.client_id = get_my_profile_id())
    )
    AND sr.status NOT IN ('CANCELLED')
  );
$$;

-- Substituir política para usar a função SECURITY DEFINER
DROP POLICY IF EXISTS "profiles_select_service_participants" ON public.profiles;

CREATE POLICY "profiles_select_service_participants"
ON public.profiles
FOR SELECT
USING (
  is_service_participant(id)
);
