-- Permitir que participantes de service_requests vejam perfis uns dos outros
-- (prestador vê perfil do cliente, cliente vê perfil do prestador)
CREATE POLICY "profiles_select_service_participants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE (
      (sr.client_id = profiles.id AND sr.provider_id = (
        SELECT p2.id FROM public.profiles p2 WHERE p2.user_id = auth.uid() LIMIT 1
      ))
      OR
      (sr.provider_id = profiles.id AND sr.client_id = (
        SELECT p2.id FROM public.profiles p2 WHERE p2.user_id = auth.uid() LIMIT 1
      ))
    )
    AND sr.status NOT IN ('CANCELLED')
  )
);