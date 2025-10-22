-- =====================================================
-- CORREÇÃO COMPLETA: Segregação de Dados por Tipo de Usuário
-- (Versão 4 - Com DROP de funções existentes)
-- =====================================================

-- ====================================
-- PARTE 1: Limpar policies antigas de freights
-- ====================================
DROP POLICY IF EXISTS "Admins can manage all freights" ON public.freights;
DROP POLICY IF EXISTS "Company drivers can view company freights" ON public.freights;
DROP POLICY IF EXISTS "Drivers can update their assigned freights" ON public.freights;
DROP POLICY IF EXISTS "Drivers can view freights" ON public.freights;
DROP POLICY IF EXISTS "Producers can update their own freights" ON public.freights;
DROP POLICY IF EXISTS "Producers can view their own freights" ON public.freights;
DROP POLICY IF EXISTS "Users can create freights including guests" ON public.freights;
DROP POLICY IF EXISTS "Users can only create their own freights" ON public.freights;
DROP POLICY IF EXISTS "Users can only update their own freights" ON public.freights;
DROP POLICY IF EXISTS "Users can only view their own freights" ON public.freights;
DROP POLICY IF EXISTS "Users can view relevant freights" ON public.freights;
DROP POLICY IF EXISTS "Usuários veem seus fretes" ON public.freights;
DROP POLICY IF EXISTS "freights_select_authenticated" ON public.freights;

-- ====================================
-- PARTE 2: Criar policies role-based simplificadas para FREIGHTS
-- ====================================

-- 1. MOTORISTAS e TRANSPORTADORAS podem ver fretes OPEN ou seus próprios
CREATE POLICY "role_motorista_transportadora_view_freights"
ON public.freights FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('MOTORISTA', 'TRANSPORTADORA')
  )
  AND (
    status = 'OPEN'
    OR driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR id IN (SELECT freight_id FROM public.freight_assignments WHERE driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    OR company_id IN (SELECT id FROM public.transport_companies WHERE profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

-- 2. PRODUTORES veem seus próprios fretes
CREATE POLICY "role_produtor_view_freights"
ON public.freights FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'PRODUTOR'
  )
  AND producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 3. ADMIN vê tudo
CREATE POLICY "role_admin_view_all_freights"
ON public.freights FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- ====================================
-- PARTE 3: RLS policies para SERVICE_REQUESTS
-- ====================================
DROP POLICY IF EXISTS "Enable read for all users" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests_select_authenticated" ON public.service_requests;

-- 1. PRESTADORES veem serviços disponíveis ou seus próprios
CREATE POLICY "role_prestador_view_services"
ON public.service_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'PRESTADOR_SERVICOS'
  )
  AND (
    status = 'OPEN'
    OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- 2. PRODUTORES veem seus próprios service_requests
CREATE POLICY "role_produtor_view_services"
ON public.service_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'PRODUTOR'
  )
  AND client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 3. ADMIN vê tudo
CREATE POLICY "role_admin_view_all_services"
ON public.service_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

-- ====================================
-- PARTE 4: RPC para motoristas - APENAS FRETES
-- ====================================
DROP FUNCTION IF EXISTS public.get_freights_for_driver(UUID);

CREATE FUNCTION public.get_freights_for_driver(p_driver_id UUID)
RETURNS TABLE (
  id UUID,
  cargo_type TEXT,
  weight NUMERIC,
  origin_address TEXT,
  destination_address TEXT,
  pickup_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  price NUMERIC,
  urgency TEXT,
  status freight_status,
  service_type TEXT,
  producer_id UUID,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::TEXT,
    f.status,
    f.service_type,
    f.producer_id,
    f.created_at
  FROM public.freights f
  WHERE f.status = 'OPEN'
    AND f.driver_id IS NULL
    -- FILTRO CRÍTICO: Apenas tipos de frete, nunca serviços
    AND COALESCE(f.service_type, 'FRETE') IN ('FRETE', 'CARGA', 'MUDANCA_INDUSTRIAL', 'TRANSPORTE_ESPECIAL')
  ORDER BY f.created_at DESC
  LIMIT 200;
END;
$$;

-- ====================================
-- PARTE 5: RPC para prestadores - APENAS SERVIÇOS
-- ====================================
DROP FUNCTION IF EXISTS public.get_services_for_provider(UUID);

CREATE FUNCTION public.get_services_for_provider(p_provider_id UUID)
RETURNS TABLE (
  request_id UUID,
  service_type TEXT,
  location_address TEXT,
  problem_description TEXT,
  urgency TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  client_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id AS request_id,
    sr.service_type,
    sr.location_address,
    sr.problem_description,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.status,
    sr.created_at,
    sr.client_id
  FROM public.service_requests sr
  WHERE sr.status = 'OPEN'
    AND sr.provider_id IS NULL
    -- FILTRO CRÍTICO: Apenas tipos de serviço, nunca fretes
    AND sr.service_type IN ('GUINCHO', 'MUDANCA', 'ELETRICISTA', 'MECANICO', 'BORRACHEIRO', 'LAVAGEM', 'INSTALACAO')
  ORDER BY sr.created_at DESC
  LIMIT 200;
END;
$$;

-- ====================================
-- PARTE 6: Criar índices para performance
-- ====================================
CREATE INDEX IF NOT EXISTS idx_freights_status_driver ON public.freights(status, driver_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_service_requests_status_provider ON public.service_requests(status, provider_id) WHERE status = 'OPEN';

COMMENT ON POLICY "role_motorista_transportadora_view_freights" ON public.freights IS 
'Motoristas e transportadoras veem APENAS fretes (nunca service_requests)';

COMMENT ON POLICY "role_prestador_view_services" ON public.service_requests IS 
'Prestadores veem APENAS service_requests (nunca freights)';