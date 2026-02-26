-- Permitir que prestadores autenticados visualizem serviços urbanos/técnicos em aberto
-- (exclui explicitamente tipos de transporte/frete)
CREATE POLICY "service_providers_view_open_service_requests"
ON public.service_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND has_role(auth.uid(), 'service_provider'::app_role)
  AND status = 'OPEN'
  AND provider_id IS NULL
  AND service_type <> ALL (
    ARRAY[
      'GUINCHO'::text,
      'MUDANCA'::text,
      'FRETE_MOTO'::text,
      'FRETE_URBANO'::text,
      'TRANSPORTE_PET'::text,
      'ENTREGA_PACOTES'::text
    ]
  )
);