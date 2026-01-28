-- =============================================
-- CORREÇÃO: Políticas RLS muito restritivas
-- =============================================
-- Problema: profiles_select_own_only e vehicles_select_owner_only
-- estão impedindo que participantes de fretes vejam dados uns dos outros.
-- Isso quebrou os cards de frete em andamento.

-- 1. Criar função para verificar se usuário é participante do mesmo frete
CREATE OR REPLACE FUNCTION is_freight_participant(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Produtor pode ver motorista do seu frete
    SELECT 1 FROM freights f
    WHERE f.producer_id = get_current_profile_id()
      AND (f.driver_id = target_profile_id OR target_profile_id = ANY(f.drivers_assigned))
    UNION
    -- Motorista pode ver produtor do seu frete
    SELECT 1 FROM freights f
    WHERE (f.driver_id = get_current_profile_id() OR get_current_profile_id() = ANY(f.drivers_assigned))
      AND f.producer_id = target_profile_id
    UNION
    -- Participantes do mesmo frete podem se ver
    SELECT 1 FROM freights f
    WHERE (f.driver_id = get_current_profile_id() OR get_current_profile_id() = ANY(f.drivers_assigned))
      AND (f.driver_id = target_profile_id OR target_profile_id = ANY(f.drivers_assigned) OR f.producer_id = target_profile_id)
    UNION
    -- Service requests: cliente pode ver prestador e vice-versa
    SELECT 1 FROM service_requests sr
    WHERE sr.client_id = get_current_profile_id() AND sr.provider_id = target_profile_id
    UNION
    SELECT 1 FROM service_requests sr
    WHERE sr.provider_id = get_current_profile_id() AND sr.client_id = target_profile_id
  )
$$;

COMMENT ON FUNCTION is_freight_participant(uuid) IS 
  'Verifica se o usuário atual pode ver o perfil do target por ser participante do mesmo frete/serviço';

-- 2. Adicionar política para participantes de fretes verem perfis uns dos outros
DROP POLICY IF EXISTS profiles_select_freight_participants ON profiles;
CREATE POLICY profiles_select_freight_participants ON profiles
  FOR SELECT
  TO authenticated
  USING (is_freight_participant(id));

-- 3. Criar função para verificar se usuário pode ver veículo por frete
CREATE OR REPLACE FUNCTION can_view_vehicle_via_freight(vehicle_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Produtor pode ver veículo do motorista que está fazendo seu frete
    SELECT 1 FROM freights f
    WHERE f.producer_id = get_current_profile_id()
      AND (f.driver_id = vehicle_driver_id OR vehicle_driver_id = ANY(f.drivers_assigned))
    UNION
    -- Motorista pode ver veículos de outros motoristas no mesmo frete
    SELECT 1 FROM freights f
    WHERE (f.driver_id = get_current_profile_id() OR get_current_profile_id() = ANY(f.drivers_assigned))
      AND (f.driver_id = vehicle_driver_id OR vehicle_driver_id = ANY(f.drivers_assigned))
  )
$$;

COMMENT ON FUNCTION can_view_vehicle_via_freight(uuid) IS 
  'Verifica se o usuário atual pode ver veículos do driver por participar do mesmo frete';

-- 4. Adicionar política para ver veículos de participantes do mesmo frete
DROP POLICY IF EXISTS vehicles_select_freight_participants ON vehicles;
CREATE POLICY vehicles_select_freight_participants ON vehicles
  FOR SELECT
  TO authenticated
  USING (can_view_vehicle_via_freight(driver_id));

-- 5. Garantir que profiles_secure view funciona corretamente para participantes
-- (a view já existe, só precisamos garantir que as políticas permitem acesso)

-- 6. Grant execute nas novas funções
GRANT EXECUTE ON FUNCTION is_freight_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_vehicle_via_freight(uuid) TO authenticated;