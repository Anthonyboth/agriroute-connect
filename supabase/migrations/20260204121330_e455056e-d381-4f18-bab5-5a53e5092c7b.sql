
-- ============================================================
-- MIGRAÇÃO DE SEGURANÇA: Corrigir 17 políticas RLS antigas
-- que usam profiles.role diretamente em vez de has_role()
-- ============================================================

-- 1. auditoria_eventos_select
DROP POLICY IF EXISTS "auditoria_eventos_select" ON public.auditoria_eventos;
CREATE POLICY "auditoria_eventos_select" ON public.auditoria_eventos
  FOR SELECT TO authenticated
  USING (
    (empresa_id IN (
      SELECT ef.id
      FROM empresas_fiscais ef
      JOIN transport_companies tc ON tc.id = ef.transport_company_id
      WHERE tc.profile_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'carrier'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. auditoria_eventos_update
DROP POLICY IF EXISTS "auditoria_eventos_update" ON public.auditoria_eventos;
CREATE POLICY "auditoria_eventos_update" ON public.auditoria_eventos
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'carrier'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (empresa_id IN (
      SELECT ef.id
      FROM empresas_fiscais ef
      JOIN transport_companies tc ON tc.id = ef.transport_company_id
      WHERE tc.profile_id = auth.uid()
    ))
  );

-- 3. ctes_select
DROP POLICY IF EXISTS "ctes_select" ON public.ctes;
CREATE POLICY "ctes_select" ON public.ctes
  FOR SELECT TO authenticated
  USING (
    (empresa_id IN (
      SELECT ef.id
      FROM empresas_fiscais ef
      JOIN transport_companies tc ON tc.id = ef.transport_company_id
      WHERE tc.profile_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'carrier'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. others_view_trip_progress
DROP POLICY IF EXISTS "others_view_trip_progress" ON public.driver_trip_progress;
CREATE POLICY "others_view_trip_progress" ON public.driver_trip_progress
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'producer'::app_role)
    OR has_role(auth.uid(), 'carrier'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. empresas_fiscais_select
DROP POLICY IF EXISTS "empresas_fiscais_select" ON public.empresas_fiscais;
CREATE POLICY "empresas_fiscais_select" ON public.empresas_fiscais
  FOR SELECT TO authenticated
  USING (
    (transport_company_id IN (
      SELECT id FROM transport_companies WHERE profile_id = auth.uid()
    ))
    OR has_role(auth.uid(), 'carrier'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 6. Drivers can update external payments
DROP POLICY IF EXISTS "Drivers can update external payments" ON public.external_payments;
CREATE POLICY "Drivers can update external payments" ON public.external_payments
  FOR UPDATE TO authenticated
  USING (
    (driver_id = get_my_profile_id())
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  )
  WITH CHECK (
    (driver_id = get_my_profile_id())
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
  );

-- 7. fiscalizacao_logs_select_transportadora
DROP POLICY IF EXISTS "fiscalizacao_logs_select_transportadora" ON public.fiscalizacao_logs;
CREATE POLICY "fiscalizacao_logs_select_transportadora" ON public.fiscalizacao_logs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'carrier'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 8. Drivers can insert proposals for open freights
DROP POLICY IF EXISTS "Drivers can insert proposals for open freights" ON public.freight_proposals;
CREATE POLICY "Drivers can insert proposals for open freights" ON public.freight_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    (driver_id = get_my_profile_id())
    AND (has_role(auth.uid(), 'driver'::app_role) OR has_role(auth.uid(), 'affiliated_driver'::app_role))
    AND (
      EXISTS (SELECT 1 FROM vehicles v WHERE v.driver_id = get_my_profile_id())
      OR EXISTS (SELECT 1 FROM company_vehicle_assignments cva 
                 WHERE cva.driver_profile_id = get_my_profile_id() AND cva.removed_at IS NULL)
    )
    AND EXISTS (
      SELECT 1 FROM freights f
      WHERE f.id = freight_proposals.freight_id
        AND f.producer_id IS NOT NULL
        AND COALESCE(f.is_guest_freight, false) = false
        AND f.status IN ('OPEN', 'IN_NEGOTIATION')
        AND f.accepted_trucks < f.required_trucks
    )
  );

-- 9. motoristas_accept_transport_services
DROP POLICY IF EXISTS "motoristas_accept_transport_services" ON public.service_requests;
CREATE POLICY "motoristas_accept_transport_services" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (
    status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
    AND provider_id IS NULL
    AND service_type IN ('GUINCHO', 'MUDANCA', 'FRETE_MOTO', 'FRETE_URBANO')
    AND has_role(auth.uid(), 'driver'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'driver'::app_role)
  );

-- 10. prestadores_accept_services
DROP POLICY IF EXISTS "prestadores_accept_services" ON public.service_requests;
CREATE POLICY "prestadores_accept_services" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (
    status IN ('OPEN', 'PENDING', 'AVAILABLE', 'CREATED')
    AND provider_id IS NULL
    AND has_role(auth.uid(), 'service_provider'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'service_provider'::app_role)
  );
