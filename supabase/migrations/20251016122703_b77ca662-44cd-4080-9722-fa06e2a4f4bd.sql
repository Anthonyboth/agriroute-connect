-- =====================================================
-- SEPARAÇÃO COMPLETA: FRETES vs SERVIÇOS (v7 - FINAL)
-- Ajustar valor padrão de price
-- =====================================================

-- 1. CRIAR ENUMS DE TIPOS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE freight_service_type AS ENUM (
    'FRETE_MOTO',
    'CARGA',
    'CARGA_GERAL',
    'CARGA_AGRICOLA',
    'CARGA_GRANEL',
    'CARGA_LIQUIDA',
    'GUINCHO',
    'MUDANCA',
    'TRANSPORTE_ANIMAIS',
    'TRANSPORTE_MAQUINARIO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_service_type AS ENUM (
    'AGRONOMO',
    'ANALISE_SOLO',
    'ASSISTENCIA_TECNICA',
    'MECANICO',
    'BORRACHEIRO',
    'CHAVEIRO',
    'AUTO_ELETRICA',
    'COMBUSTIVEL',
    'LIMPEZA_RURAL',
    'PULVERIZACAO_DRONE',
    'COLHEITA_TERCEIRIZADA',
    'TOPOGRAFIA',
    'ENERGIA_SOLAR',
    'CONSULTORIA_RURAL',
    'VETERINARIO',
    'OUTROS'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. ADICIONAR COLUNAS FALTANTES À TABELA FREIGHTS
-- =====================================================

ALTER TABLE freights 
ADD COLUMN IF NOT EXISTS problem_description TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- 3. FUNÇÃO DE MIGRAÇÃO DE DADOS
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_freight_requests_to_freights()
RETURNS TABLE (
  migrated_id uuid,
  svc_type text,
  from_table text,
  to_table text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freight_types text[] := ARRAY[
    'FRETE_MOTO', 'CARGA', 'CARGA_GERAL', 'CARGA_AGRICOLA', 
    'CARGA_GRANEL', 'CARGA_LIQUIDA', 'GUINCHO', 'MUDANCA',
    'TRANSPORTE_ANIMAIS', 'TRANSPORTE_MAQUINARIO'
  ];
  request_record record;
BEGIN
  FOR request_record IN 
    SELECT sr.* FROM service_requests sr
    WHERE sr.service_type = ANY(freight_types)
  LOOP
    -- Inserir em freights
    INSERT INTO freights (
      id,
      producer_id,
      cargo_type,
      service_type,
      weight,
      origin_address,
      origin_city,
      origin_state,
      origin_lat,
      origin_lng,
      destination_address,
      destination_city,
      destination_state,
      destination_lat,
      destination_lng,
      pickup_date,
      delivery_date,
      price,
      status,
      problem_description,
      contact_phone,
      created_at,
      updated_at
    ) VALUES (
      request_record.id,
      request_record.client_id,
      COALESCE(request_record.service_type, 'CARGA'),
      request_record.service_type,
      100,
      request_record.location_address,
      request_record.city_name,
      request_record.state,
      request_record.location_lat,
      request_record.location_lng,
      request_record.location_address,
      request_record.city_name,
      request_record.state,
      request_record.location_lat,
      request_record.location_lng,
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '1 day',
      GREATEST(COALESCE(request_record.estimated_price, 100), 1),
      CASE 
        WHEN request_record.provider_id IS NOT NULL THEN 'ACCEPTED'::freight_status
        ELSE 'OPEN'::freight_status
      END,
      request_record.problem_description,
      request_record.contact_phone,
      request_record.created_at,
      request_record.updated_at
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Deletar de service_requests
    DELETE FROM service_requests WHERE id = request_record.id;
    
    RETURN QUERY SELECT 
      request_record.id,
      request_record.service_type,
      'service_requests'::text,
      'freights'::text;
  END LOOP;
END;
$$;

-- 4. EXECUTAR MIGRAÇÃO
-- =====================================================
SELECT * FROM migrate_freight_requests_to_freights();

-- 5. ADICIONAR CONSTRAINTS (após migração)
-- =====================================================

ALTER TABLE freights 
DROP CONSTRAINT IF EXISTS check_freight_service_type;

ALTER TABLE freights 
ADD CONSTRAINT check_freight_service_type 
CHECK (service_type::text = ANY(ARRAY[
  'FRETE_MOTO', 'CARGA', 'CARGA_GERAL', 'CARGA_AGRICOLA', 
  'CARGA_GRANEL', 'CARGA_LIQUIDA', 'GUINCHO', 'MUDANCA',
  'TRANSPORTE_ANIMAIS', 'TRANSPORTE_MAQUINARIO'
]::text[]));

ALTER TABLE service_requests 
DROP CONSTRAINT IF EXISTS check_provider_service_type;

ALTER TABLE service_requests 
ADD CONSTRAINT check_provider_service_type 
CHECK (service_type::text = ANY(ARRAY[
  'AGRONOMO', 'ANALISE_SOLO', 'ASSISTENCIA_TECNICA', 'MECANICO',
  'BORRACHEIRO', 'CHAVEIRO', 'AUTO_ELETRICA', 'COMBUSTIVEL',
  'LIMPEZA_RURAL', 'PULVERIZACAO_DRONE', 'COLHEITA_TERCEIRIZADA',
  'TOPOGRAFIA', 'ENERGIA_SOLAR', 'CONSULTORIA_RURAL',
  'VETERINARIO', 'OUTROS'
]::text[]));

-- 6. RPC EXCLUSIVA PARA MOTORISTAS
-- =====================================================

CREATE OR REPLACE FUNCTION get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  freight_id uuid,
  cargo_type text,
  service_type text,
  weight numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text,
  destination_city text,
  destination_state text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status freight_status,
  distance_km numeric,
  minimum_antt_price numeric,
  required_trucks integer,
  accepted_trucks integer,
  available_slots integer,
  is_partial_booking boolean,
  producer_id uuid,
  producer_name text,
  producer_phone text,
  match_type text,
  distance_m numeric,
  match_score numeric,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id AS freight_id,
    f.cargo_type,
    f.service_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.origin_lat,
    f.origin_lng,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.pickup_date,
    f.delivery_date,
    f.price,
    COALESCE(f.urgency, 'NORMAL') AS urgency,
    f.status,
    f.distance_km,
    f.minimum_antt_price,
    COALESCE(f.required_trucks, 1) AS required_trucks,
    COALESCE(f.accepted_trucks, 0) AS accepted_trucks,
    (COALESCE(f.required_trucks, 1) - COALESCE(f.accepted_trucks, 0)) AS available_slots,
    (COALESCE(f.accepted_trucks, 0) > 0 AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)) AS is_partial_booking,
    f.producer_id,
    p.full_name AS producer_name,
    p.contact_phone AS producer_phone,
    fm.match_type,
    fm.distance_m,
    fm.match_score,
    f.created_at
  FROM freights f
  LEFT JOIN freight_matches fm ON fm.freight_id = f.id AND fm.driver_id = p_driver_id
  LEFT JOIN profiles p ON p.id = f.producer_id
  WHERE (
    f.status = 'OPEN'::freight_status
    OR (
      f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
    )
  )
  AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments fa
    WHERE fa.freight_id = f.id 
    AND fa.driver_id = p_driver_id
    AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  )
  AND f.service_type IN ('FRETE_MOTO', 'CARGA', 'CARGA_GERAL', 'CARGA_AGRICOLA', 'GUINCHO', 'MUDANCA', 'TRANSPORTE_ANIMAIS', 'TRANSPORTE_MAQUINARIO')
  ORDER BY fm.distance_m NULLS LAST, f.created_at DESC;
END;
$$;

-- 7. RPC EXCLUSIVA PARA PRESTADORES
-- =====================================================

CREATE OR REPLACE FUNCTION get_services_for_provider(p_provider_id uuid)
RETURNS TABLE (
  request_id uuid,
  client_id uuid,
  service_type text,
  location_address text,
  city_name text,
  state text,
  location_lat numeric,
  location_lng numeric,
  problem_description text,
  vehicle_info text,
  urgency text,
  contact_phone text,
  contact_name text,
  additional_info text,
  is_emergency boolean,
  estimated_price numeric,
  status text,
  created_at timestamptz,
  match_type text,
  distance_m numeric,
  match_score numeric,
  client_name text,
  client_phone text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id AS request_id,
    sr.client_id,
    sr.service_type,
    sr.location_address,
    sr.city_name,
    sr.state,
    sr.location_lat,
    sr.location_lng,
    sr.problem_description,
    sr.vehicle_info,
    sr.urgency,
    sr.contact_phone,
    sr.contact_name,
    sr.additional_info,
    sr.is_emergency,
    sr.estimated_price,
    sr.status,
    sr.created_at,
    sm.match_type,
    sm.distance_m,
    sm.match_score,
    p.full_name AS client_name,
    p.phone AS client_phone
  FROM service_requests sr
  LEFT JOIN service_matches sm ON sm.service_request_id = sr.id AND sm.provider_id = p_provider_id
  LEFT JOIN profiles p ON p.id = sr.client_id
  WHERE sr.status = 'OPEN'
  AND sr.provider_id IS NULL
  AND sr.service_type IN ('AGRONOMO', 'ANALISE_SOLO', 'ASSISTENCIA_TECNICA', 'MECANICO', 'BORRACHEIRO', 'CHAVEIRO', 'AUTO_ELETRICA', 'COMBUSTIVEL', 'LIMPEZA_RURAL', 'PULVERIZACAO_DRONE', 'COLHEITA_TERCEIRIZADA', 'TOPOGRAFIA', 'ENERGIA_SOLAR', 'CONSULTORIA_RURAL', 'VETERINARIO', 'OUTROS')
  ORDER BY sm.distance_m NULLS LAST, sr.created_at DESC;
END;
$$;