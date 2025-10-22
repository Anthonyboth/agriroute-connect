-- ===================================
-- CORREÇÃO CRÍTICA: RLS service_requests
-- ===================================

-- 1. REMOVER POLICIES PROBLEMÁTICAS
DROP POLICY IF EXISTS "Usuários podem ver suas próprias solicitações" ON service_requests;
DROP POLICY IF EXISTS "service_requests_select_simple" ON service_requests;
DROP POLICY IF EXISTS "Enable read for all users" ON service_requests;
DROP POLICY IF EXISTS "service_requests_select_authenticated" ON service_requests;

-- 2. CRIAR FUNCTION HELPER PARA ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'ADMIN'
  );
$$;

-- 3. CRIAR POLICIES SEGURAS POR ROLE

-- ADMIN: vê tudo
CREATE POLICY "admin_view_all_service_requests"
ON service_requests FOR SELECT TO authenticated
USING (public.is_admin());

-- PRODUTOR/CLIENTE: vê apenas seus pedidos
CREATE POLICY "clients_view_own_service_requests"
ON service_requests FOR SELECT TO authenticated
USING (
  client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- PRESTADOR: vê serviços disponíveis + seus aceitos
CREATE POLICY "providers_view_service_requests"
ON service_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'PRESTADOR_SERVICOS'
  )
  AND (
    (status = 'OPEN' AND provider_id IS NULL)
    OR (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);

-- MOTORISTA: vê APENAS GUINCHO/MUDANCA (transporte)
CREATE POLICY "drivers_view_transport_requests"
ON service_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )
  AND service_type IN ('GUINCHO', 'MUDANCA')
  AND (
    (status = 'OPEN' AND provider_id IS NULL)
    OR (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);

-- ===================================
-- DADOS DE TESTE
-- ===================================

-- 4. CRIAR FRETES OPEN PARA MOTORISTAS TESTAREM
INSERT INTO freights (
  producer_id,
  origin_address,
  destination_address,
  origin_city,
  destination_city,
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
  cargo_type,
  weight,
  price,
  pickup_date,
  delivery_date,
  status,
  vehicle_type_required,
  required_trucks,
  accepted_trucks,
  urgency
)
SELECT 
  (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
  'Fazenda São João - Primavera do Leste, MT',
  'Armazém Central - Cuiabá, MT',
  'Primavera do Leste, MT',
  'Cuiabá, MT',
  -15.5567,
  -54.2957,
  -15.6014,
  -56.0979,
  'Soja',
  30.0 + (series * 5),
  1500.00 + (series * 100),
  (CURRENT_DATE + INTERVAL '2 days')::date,
  (CURRENT_DATE + INTERVAL '5 days')::date,
  'OPEN',
  'TRUCK',
  1,
  0,
  'MEDIUM'
FROM generate_series(1, 2) AS series
WHERE NOT EXISTS (
  SELECT 1 FROM freights 
  WHERE status = 'OPEN' 
  LIMIT 5
);

-- 5. CRIAR SERVICE_REQUESTS PARA PRESTADORES TESTAREM
INSERT INTO service_requests (
  client_id,
  service_type,
  status,
  contact_phone,
  location_address,
  location_city,
  location_lat,
  location_lng,
  problem_description,
  estimated_price
)
SELECT * FROM (
  VALUES
    (
      (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
      'MECANICA',
      'OPEN',
      '(65) 99999-0001',
      'Primavera do Leste, MT',
      'Primavera do Leste',
      -15.5567,
      -54.2957,
      '🔧 Teste: Manutenção preventiva de veículo',
      250.00
    ),
    (
      (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
      'ELETRICISTA',
      'OPEN',
      '(65) 99999-0002',
      'Cuiabá, MT',
      'Cuiabá',
      -15.6014,
      -56.0979,
      '⚡ Teste: Instalação elétrica rural',
      180.00
    ),
    (
      (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
      'LAVAGEM',
      'OPEN',
      '(65) 99999-0003',
      'Lucas do Rio Verde, MT',
      'Lucas do Rio Verde',
      -13.0535,
      -55.9086,
      '🚿 Teste: Lavagem de veículos',
      80.00
    )
) AS new_services(client_id, service_type, status, contact_phone, location_address, location_city, location_lat, location_lng, problem_description, estimated_price)
WHERE NOT EXISTS (
  SELECT 1 FROM service_requests 
  WHERE status = 'OPEN' 
  AND service_type IN ('MECANICA', 'ELETRICISTA', 'LAVAGEM')
  LIMIT 3
);