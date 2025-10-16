-- ================================================
-- MIGRAÇÃO DEFINITIVA: Correção de Triggers Duplicados
-- ================================================
-- Objetivo: Remover todas as triggers duplicadas que causam
-- incremento múltiplo de accepted_trucks e criar UMA ÚNICA
-- trigger idempotente para sincronização.

-- ================================================
-- 1. REMOVER TRIGGERS DUPLICADOS
-- ================================================

-- Remover triggers em freight_assignments que atualizam accepted_trucks
DROP TRIGGER IF EXISTS trigger_sync_accepted_trucks ON freight_assignments;
DROP TRIGGER IF EXISTS sync_freight_accepted_trucks_trigger ON freight_assignments;
DROP TRIGGER IF EXISTS sync_freight_trucks_on_assignment ON freight_assignments;

-- Remover trigger em freight_proposals que também atualiza accepted_trucks
DROP TRIGGER IF EXISTS update_trucks_count_trigger ON freight_proposals;

-- Remover funções antigas relacionadas (se não usadas em outro lugar)
DROP FUNCTION IF EXISTS sync_accepted_trucks() CASCADE;
DROP FUNCTION IF EXISTS update_accepted_trucks_count() CASCADE;

-- ================================================
-- 2. CRIAR FUNÇÃO IDEMPOTENTE DE SINCRONIZAÇÃO
-- ================================================

CREATE OR REPLACE FUNCTION public.recalc_freight_accepted_trucks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_freight_id UUID;
  actual_count INTEGER;
  required_count INTEGER;
  current_status freight_status;
  unique_drivers UUID[];
BEGIN
  -- Determinar qual freight_id processar
  IF TG_OP = 'DELETE' THEN
    target_freight_id := OLD.freight_id;
  ELSE
    target_freight_id := NEW.freight_id;
  END IF;

  -- Contar assignments aceitos (não cancelados/rejeitados)
  SELECT COUNT(*), array_agg(DISTINCT driver_id)
  INTO actual_count, unique_drivers
  FROM freight_assignments
  WHERE freight_id = target_freight_id
    AND status NOT IN ('CANCELLED', 'REJECTED');

  -- Buscar dados do frete
  SELECT required_trucks, status
  INTO required_count, current_status
  FROM freights
  WHERE id = target_freight_id;

  -- Atualizar accepted_trucks e drivers_assigned
  UPDATE freights
  SET 
    accepted_trucks = COALESCE(actual_count, 0),
    drivers_assigned = COALESCE(unique_drivers, ARRAY[]::UUID[]),
    is_full_booking = (COALESCE(actual_count, 0) >= COALESCE(required_count, 1)),
    -- Ajustar status apenas se necessário
    status = CASE
      -- Se frete já está em status final, não mexer
      WHEN status IN ('DELIVERED', 'CANCELLED') THEN status
      -- Se tem multiple trucks e está parcialmente preenchido, voltar para OPEN
      WHEN COALESCE(required_count, 1) > 1 
           AND COALESCE(actual_count, 0) > 0 
           AND COALESCE(actual_count, 0) < COALESCE(required_count, 1)
           AND status NOT IN ('OPEN', 'DELIVERED', 'CANCELLED')
      THEN 'OPEN'::freight_status
      -- Se preencheu todas as vagas, mudar para ACCEPTED
      WHEN COALESCE(actual_count, 0) >= COALESCE(required_count, 1)
           AND status = 'OPEN'::freight_status
      THEN 'ACCEPTED'::freight_status
      -- Manter status atual
      ELSE status
    END,
    updated_at = now()
  WHERE id = target_freight_id;

  -- Log da operação
  RAISE LOG 'recalc_freight_accepted_trucks: freight_id=%, actual_count=%, required_count=%, new_status=%',
    target_freight_id, actual_count, required_count, 
    (SELECT status FROM freights WHERE id = target_freight_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ================================================
-- 3. CRIAR TRIGGER ÚNICO
-- ================================================

CREATE TRIGGER recalc_accepted_trucks
AFTER INSERT OR UPDATE OR DELETE ON freight_assignments
FOR EACH ROW
EXECUTE FUNCTION public.recalc_freight_accepted_trucks();

-- ================================================
-- 4. CORREÇÃO DE DADOS EXISTENTES (IDEMPOTENTE)
-- ================================================

-- Recalcular accepted_trucks para todos os fretes
UPDATE freights f
SET 
  accepted_trucks = (
    SELECT COUNT(*)
    FROM freight_assignments fa
    WHERE fa.freight_id = f.id
      AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  ),
  drivers_assigned = (
    SELECT array_agg(DISTINCT driver_id)
    FROM freight_assignments fa
    WHERE fa.freight_id = f.id
      AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  ),
  is_full_booking = (
    (SELECT COUNT(*)
     FROM freight_assignments fa
     WHERE fa.freight_id = f.id
       AND fa.status NOT IN ('CANCELLED', 'REJECTED')
    ) >= COALESCE(f.required_trucks, 1)
  ),
  updated_at = now()
WHERE f.id IN (
  SELECT DISTINCT freight_id FROM freight_assignments
);

-- Ajustar status de fretes parcialmente preenchidos
UPDATE freights
SET 
  status = 'OPEN'::freight_status,
  updated_at = now()
WHERE status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  AND COALESCE(accepted_trucks, 0) < COALESCE(required_trucks, 1)
  AND COALESCE(required_trucks, 1) > 1;