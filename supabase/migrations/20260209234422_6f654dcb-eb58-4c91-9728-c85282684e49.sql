-- Permitir que participantes de fretes ativos vejam perfis uns dos outros
-- Usa a função is_freight_participant já existente que valida relação via freights/service_requests
CREATE POLICY "profiles_select_freight_participants"
ON public.profiles
FOR SELECT
USING (
  public.is_freight_participant(id)
);