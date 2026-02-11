-- Substituir política de participantes de serviço para usar helper otimizado
DROP POLICY IF EXISTS "profiles_select_service_participants" ON public.profiles;

CREATE POLICY "profiles_select_service_participants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE (
      (sr.client_id = profiles.id AND sr.provider_id = get_my_profile_id())
      OR
      (sr.provider_id = profiles.id AND sr.client_id = get_my_profile_id())
    )
    AND sr.status NOT IN ('CANCELLED')
  )
);