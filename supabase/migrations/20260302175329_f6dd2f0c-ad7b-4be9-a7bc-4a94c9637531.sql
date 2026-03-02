
-- Fix: Drop failed company policy and recreate with correct column name
DROP POLICY IF EXISTS "dlh_select_company_active_freight_24h" ON public.driver_location_history;

CREATE POLICY "dlh_select_company_active_freight_24h"
ON public.driver_location_history
FOR SELECT TO authenticated
USING (
  freight_id IS NOT NULL
  AND captured_at > now() - INTERVAL '24 hours'
  AND EXISTS (
    SELECT 1 FROM public.freights f
    JOIN public.freight_assignments fa ON fa.freight_id = f.id
    JOIN public.company_drivers cd ON cd.driver_profile_id = fa.driver_id AND cd.status = 'active'
    JOIN public.transport_companies tc ON tc.id = cd.company_id
    WHERE f.id = driver_location_history.freight_id
    AND tc.profile_id = auth.uid()
    AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  )
);

COMMENT ON TABLE public.driver_location_history IS 
'Histórico de localização GPS de motoristas. Dados sensíveis com proteção multicamada:
- Motorista: vê apenas sua própria localização (7 dias)
- Produtor: vê apenas durante frete ATIVO (24h, status IN_TRANSIT/LOADING/LOADED/ACCEPTED)
- Transportadora: mesmas restrições do produtor via profile_id
- Dados deletados automaticamente 24h após conclusão do frete via cleanup_expired_driver_locations()
- Acesso anônimo bloqueado';
