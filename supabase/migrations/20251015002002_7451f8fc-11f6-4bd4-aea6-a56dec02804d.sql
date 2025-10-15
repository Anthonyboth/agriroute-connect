-- REMOVER função e trigger de limite de fretes ativos
DROP FUNCTION IF EXISTS check_driver_active_freight_limit() CASCADE;
DROP TRIGGER IF EXISTS validate_driver_active_freight_limit ON freight_assignments;

-- ATUALIZAR função sync_accepted_trucks
CREATE OR REPLACE FUNCTION sync_accepted_trucks()
RETURNS TRIGGER AS $$
DECLARE
  v_freight_id UUID;
  v_accepted_count INT;
  v_required_count INT;
  v_drivers UUID[];
  v_new_status freight_status;
BEGIN
  v_freight_id := COALESCE(NEW.freight_id, OLD.freight_id);
  
  -- Calcular accepted_trucks e drivers_assigned
  SELECT 
    COUNT(*) FILTER (WHERE status = 'ACCEPTED'), 
    array_agg(DISTINCT driver_id) FILTER (WHERE status = 'ACCEPTED'),
    f.required_trucks
  INTO v_accepted_count, v_drivers, v_required_count
  FROM freight_assignments fa
  JOIN freights f ON f.id = v_freight_id
  WHERE fa.freight_id = v_freight_id
  GROUP BY f.required_trucks;
  
  -- Determinar status
  IF v_accepted_count >= v_required_count THEN
    v_new_status := 'IN_NEGOTIATION';
  ELSE
    v_new_status := 'OPEN';
  END IF;
  
  -- Atualizar frete (apenas se required_trucks > 1)
  UPDATE freights
  SET 
    accepted_trucks = COALESCE(v_accepted_count, 0),
    drivers_assigned = COALESCE(v_drivers, ARRAY[]::UUID[]),
    status = CASE 
      WHEN status = 'OPEN' AND required_trucks > 1 THEN v_new_status
      ELSE status
    END,
    driver_id = CASE 
      WHEN required_trucks > 1 THEN NULL
      ELSE driver_id
    END
  WHERE id = v_freight_id
  AND required_trucks > 1
  AND (
    accepted_trucks IS DISTINCT FROM COALESCE(v_accepted_count, 0) 
    OR drivers_assigned IS DISTINCT FROM COALESCE(v_drivers, ARRAY[]::UUID[])
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;