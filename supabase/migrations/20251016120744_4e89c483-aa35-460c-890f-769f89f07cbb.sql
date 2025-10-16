-- =========================================
-- SISTEMA DE MÚLTIPLAS CARRETAS - CORREÇÃO COMPLETA
-- =========================================

-- 1. Nova RPC para buscar fretes compatíveis (incluindo parcialmente preenchidos)
CREATE OR REPLACE FUNCTION get_compatible_freights_for_driver_v2(p_driver_id uuid)
RETURNS TABLE (
  id uuid,
  producer_id uuid,
  cargo_type text,
  origin_address text,
  origin_city text,
  origin_state text,
  origin_lat numeric,
  origin_lng numeric,
  destination_address text,
  destination_city text,
  destination_state text,
  destination_lat numeric,
  destination_lng numeric,
  price numeric,
  distance_km numeric,
  weight numeric,
  urgent boolean,
  urgency_level text,
  status freight_status,
  scheduled_date date,
  pickup_date date,
  delivery_date date,
  vehicle_type text,
  required_trucks integer,
  accepted_trucks integer,
  available_slots integer,
  is_partial_booking boolean,
  is_full_booking boolean,
  service_type text,
  created_at timestamp with time zone,
  distance_m numeric,
  match_score numeric
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.producer_id,
    f.cargo_type,
    f.origin_address,
    f.origin_city,
    f.origin_state,
    f.origin_lat,
    f.origin_lng,
    f.destination_address,
    f.destination_city,
    f.destination_state,
    f.destination_lat,
    f.destination_lng,
    f.price,
    f.distance_km,
    f.weight,
    f.urgent,
    f.urgency_level,
    f.status,
    f.scheduled_date,
    f.pickup_date,
    f.delivery_date,
    f.vehicle_type,
    COALESCE(f.required_trucks, 1) as required_trucks,
    COALESCE(f.accepted_trucks, 0) as accepted_trucks,
    (COALESCE(f.required_trucks, 1) - COALESCE(f.accepted_trucks, 0)) as available_slots,
    (COALESCE(f.accepted_trucks, 0) > 0 AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)) as is_partial_booking,
    f.is_full_booking,
    f.service_type,
    f.created_at,
    fm.distance_m,
    fm.match_score
  FROM freights f
  JOIN freight_matches fm ON fm.freight_id = f.id AND fm.driver_id = p_driver_id
  WHERE (
    -- Frete totalmente disponível
    f.status = 'OPEN'::freight_status
    OR
    -- Frete parcialmente preenchido (ainda aceita motoristas)
    (f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
     AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1))
  )
  AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
  -- Não mostrar fretes onde o motorista já aceitou
  AND NOT EXISTS (
    SELECT 1 FROM freight_assignments fa
    WHERE fa.freight_id = f.id 
    AND fa.driver_id = p_driver_id
    AND fa.status NOT IN ('CANCELLED', 'REJECTED')
  )
  ORDER BY fm.distance_m NULLS LAST, f.created_at DESC;
END;
$$;

-- 2. Corrigir trigger de sincronização de carretas aceitas
CREATE OR REPLACE FUNCTION sync_freight_accepted_trucks()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE freights 
    SET 
      accepted_trucks = COALESCE(accepted_trucks, 0) + 1,
      drivers_assigned = array_append(COALESCE(drivers_assigned, ARRAY[]::uuid[]), NEW.driver_id),
      is_full_booking = (COALESCE(accepted_trucks, 0) + 1) >= COALESCE(required_trucks, 1),
      -- LÓGICA CORRETA: Só muda status quando TOTALMENTE preenchido
      status = CASE 
        WHEN (COALESCE(accepted_trucks, 0) + 1) >= COALESCE(required_trucks, 1) THEN 'ACCEPTED'::freight_status
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = NEW.freight_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE freights 
    SET 
      accepted_trucks = GREATEST(0, COALESCE(accepted_trucks, 0) - 1),
      drivers_assigned = array_remove(COALESCE(drivers_assigned, ARRAY[]::uuid[]), OLD.driver_id),
      is_full_booking = (GREATEST(0, COALESCE(accepted_trucks, 0) - 1)) >= COALESCE(required_trucks, 1),
      -- VOLTA PARA OPEN se perdeu motorista e tem vagas
      status = CASE 
        WHEN (GREATEST(0, COALESCE(accepted_trucks, 0) - 1)) < COALESCE(required_trucks, 1) 
          AND status NOT IN ('DELIVERED', 'CANCELLED') 
        THEN 'OPEN'::freight_status
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = OLD.freight_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS sync_freight_accepted_trucks_trigger ON freight_assignments;
CREATE TRIGGER sync_freight_accepted_trucks_trigger
AFTER INSERT OR DELETE ON freight_assignments
FOR EACH ROW
EXECUTE FUNCTION sync_freight_accepted_trucks();

-- 3. Trigger para prevenir mudanças de status inválidas
CREATE OR REPLACE FUNCTION prevent_invalid_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- IMPEDIR que frete vá para status final se ainda tem vagas
  IF NEW.status IN ('DELIVERED', 'CANCELLED')
     AND COALESCE(NEW.accepted_trucks, 0) < COALESCE(NEW.required_trucks, 1)
     AND COALESCE(NEW.required_trucks, 1) > 1
     AND OLD.status = 'OPEN' THEN
    RAISE EXCEPTION 'Não é possível mudar status do frete para % pois ainda há % vagas disponíveis (% de % carretas aceitas)',
      NEW.status, (NEW.required_trucks - NEW.accepted_trucks), NEW.accepted_trucks, NEW.required_trucks;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_freight_status_before_update ON freights;
CREATE TRIGGER check_freight_status_before_update
BEFORE UPDATE OF status ON freights
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION prevent_invalid_freight_status_changes();

-- 4. Função para corrigir fretes com status errado
CREATE OR REPLACE FUNCTION fix_freight_status_for_partial_bookings()
RETURNS TABLE (
  freight_id uuid,
  old_status freight_status,
  new_status freight_status,
  required_trucks integer,
  accepted_trucks integer,
  available_slots integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE freights f
  SET status = 'OPEN'::freight_status,
      updated_at = NOW()
  WHERE f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
    AND COALESCE(f.accepted_trucks, 0) < COALESCE(f.required_trucks, 1)
    AND COALESCE(f.required_trucks, 1) > 1
  RETURNING 
    f.id AS freight_id,
    f.status AS old_status,
    'OPEN'::freight_status AS new_status,
    COALESCE(f.required_trucks, 1) AS required_trucks,
    COALESCE(f.accepted_trucks, 0) AS accepted_trucks,
    (COALESCE(f.required_trucks, 1) - COALESCE(f.accepted_trucks, 0)) AS available_slots;
END;
$$;

-- 5. Trigger para log de mudanças de status (auditoria)
CREATE OR REPLACE FUNCTION log_freight_status_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (
      user_id,
      table_name,
      operation,
      old_data,
      new_data,
      timestamp
    ) VALUES (
      auth.uid(),
      'freights',
      'STATUS_CHANGE',
      jsonb_build_object(
        'freight_id', OLD.id,
        'old_status', OLD.status,
        'required_trucks', COALESCE(OLD.required_trucks, 1),
        'accepted_trucks', COALESCE(OLD.accepted_trucks, 0)
      ),
      jsonb_build_object(
        'freight_id', NEW.id,
        'new_status', NEW.status,
        'required_trucks', COALESCE(NEW.required_trucks, 1),
        'accepted_trucks', COALESCE(NEW.accepted_trucks, 0)
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_freight_status_changes ON freights;
CREATE TRIGGER audit_freight_status_changes
AFTER UPDATE OF status ON freights
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_freight_status_changes();

-- 6. Executar correção de fretes existentes com status errado
SELECT * FROM fix_freight_status_for_partial_bookings();