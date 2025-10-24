-- Adicionar coluna visibility_filter na tabela freights
ALTER TABLE freights ADD COLUMN IF NOT EXISTS visibility_filter TEXT DEFAULT 'ALL';

-- Comentário explicativo
COMMENT ON COLUMN freights.visibility_filter IS 
  'Filtro de visibilidade: ALL, TRANSPORTADORAS, AUTONOMOS, AVALIACAO_3, AVALIACAO_4';

-- Criar índice condicional para otimizar queries
CREATE INDEX IF NOT EXISTS idx_freights_visibility_filter 
  ON freights(visibility_filter) 
  WHERE service_type = 'CARGA';

-- Adicionar constraint para validar valores
ALTER TABLE freights DROP CONSTRAINT IF EXISTS check_visibility_filter;
ALTER TABLE freights ADD CONSTRAINT check_visibility_filter
  CHECK (visibility_filter IN ('ALL', 'TRANSPORTADORAS', 'AUTONOMOS', 'AVALIACAO_3', 'AVALIACAO_4'));

-- Drop função existente antes de recriar
DROP FUNCTION IF EXISTS public.get_freights_for_driver(uuid);

-- Atualizar função get_freights_for_driver com filtro de visibilidade
CREATE OR REPLACE FUNCTION public.get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  origin_city text,
  origin_state text,
  destination_address text,
  destination_city text,
  destination_state text,
  price numeric,
  distance_km numeric,
  pickup_date timestamptz,
  delivery_date timestamptz,
  urgency text,
  status text,
  service_type text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  driver_role TEXT;
  driver_rating NUMERIC;
  driver_is_company BOOLEAN;
  user_type TEXT;
BEGIN
  -- Buscar role e rating do motorista
  SELECT 
    p.role,
    COALESCE(p.rating, 0),
    EXISTS(SELECT 1 FROM transport_companies WHERE profile_id = p_driver_id)
  INTO driver_role, driver_rating, driver_is_company
  FROM profiles p
  WHERE p.id = p_driver_id;
  
  -- Determinar tipo do motorista
  IF driver_is_company OR driver_role = 'TRANSPORTADORA' THEN
    user_type := 'TRANSPORTADORA';
  ELSE
    user_type := 'AUTONOMO';
  END IF;
  
  -- Retornar fretes filtrados
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.price,
    f.distance_km,
    f.pickup_date,
    f.delivery_date,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.created_at
  FROM freights f
  WHERE f.status = 'OPEN'
    AND f.service_type = 'CARGA'
    AND (
      COALESCE(f.visibility_filter, 'ALL') = 'ALL'
      OR (f.visibility_filter = 'TRANSPORTADORAS' AND user_type = 'TRANSPORTADORA')
      OR (f.visibility_filter = 'AUTONOMOS' AND user_type = 'AUTONOMO')
      OR (f.visibility_filter = 'AVALIACAO_3' AND driver_rating >= 3)
      OR (f.visibility_filter = 'AVALIACAO_4' AND driver_rating >= 4)
    )
  ORDER BY f.created_at DESC;
END;
$$;

-- Criar função reopen_freight para duplicar fretes concluídos
CREATE OR REPLACE FUNCTION public.reopen_freight(p_freight_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_freight_id uuid;
  original_freight RECORD;
  current_profile_id uuid;
BEGIN
  -- Obter profile do usuário autenticado
  SELECT id INTO current_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF current_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  -- Verificar se frete existe e está concluído
  SELECT * INTO original_freight
  FROM freights
  WHERE id = p_freight_id
    AND status IN ('DELIVERED', 'CANCELLED');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Frete não encontrado ou não pode ser reaberto';
  END IF;
  
  -- Verificar se usuário é o dono
  IF original_freight.producer_id != current_profile_id THEN
    RAISE EXCEPTION 'Você não tem permissão para reabrir este frete';
  END IF;
  
  -- Duplicar frete
  INSERT INTO freights (
    producer_id,
    cargo_type,
    weight,
    origin_address,
    origin_city,
    origin_state,
    origin_city_id,
    origin_lat,
    origin_lng,
    destination_address,
    destination_city,
    destination_state,
    destination_city_id,
    destination_lat,
    destination_lng,
    distance_km,
    price,
    price_per_km,
    minimum_antt_price,
    required_trucks,
    accepted_trucks,
    pickup_date,
    delivery_date,
    urgency,
    description,
    service_type,
    vehicle_type_required,
    vehicle_axles_required,
    high_performance,
    visibility_filter,
    payment_method,
    pickup_observations,
    delivery_observations,
    status,
    metadata
  )
  SELECT
    producer_id,
    cargo_type,
    weight,
    origin_address,
    origin_city,
    origin_state,
    origin_city_id,
    origin_lat,
    origin_lng,
    destination_address,
    destination_city,
    destination_state,
    destination_city_id,
    destination_lat,
    destination_lng,
    distance_km,
    price,
    price_per_km,
    minimum_antt_price,
    required_trucks,
    0 as accepted_trucks,
    pickup_date,
    delivery_date,
    urgency,
    CASE 
      WHEN description IS NOT NULL AND description != '' 
      THEN description || E'\n\n🔄 Reabertura do frete #' || substring(p_freight_id::text, 1, 8)
      ELSE '🔄 Reabertura do frete #' || substring(p_freight_id::text, 1, 8)
    END as description,
    service_type,
    vehicle_type_required,
    vehicle_axles_required,
    high_performance,
    COALESCE(visibility_filter, 'ALL') as visibility_filter,
    payment_method,
    pickup_observations,
    delivery_observations,
    'OPEN' as status,
    jsonb_build_object(
      'reopened_from', p_freight_id,
      'reopened_at', NOW()
    ) as metadata
  FROM freights
  WHERE id = p_freight_id
  RETURNING id INTO new_freight_id;
  
  RETURN new_freight_id;
END;
$$;