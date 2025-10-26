-- Sincronizar assignments com status dos freights (sem triggerar recalc)
DO $$
DECLARE
  v_assignment RECORD;
  v_updated integer := 0;
BEGIN
  -- Desabilitar o trigger de recalc temporariamente
  ALTER TABLE freight_assignments DISABLE TRIGGER recalc_accepted_trucks;
  
  -- Atualizar assignments desatualizados
  FOR v_assignment IN
    SELECT 
      fa.id,
      f.status as new_status
    FROM freight_assignments fa
    JOIN freights f ON f.id = fa.freight_id
    WHERE fa.status::text != f.status::text
      AND f.status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED')
  LOOP
    UPDATE freight_assignments
    SET 
      status = v_assignment.new_status::freight_status,
      updated_at = NOW()
    WHERE id = v_assignment.id;
    
    v_updated := v_updated + 1;
  END LOOP;
  
  -- Reabilitar o trigger
  ALTER TABLE freight_assignments ENABLE TRIGGER recalc_accepted_trucks;
  
  RAISE NOTICE 'Sincronizados % assignments com status finais', v_updated;
END $$;