-- Criar função RPC para sincronizar assignment status sem triggerar recalc
CREATE OR REPLACE FUNCTION sync_assignment_status_bulk(
  assignment_ids uuid[],
  freight_statuses text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_failed integer := 0;
  v_idx integer;
BEGIN
  -- Desabilitar temporariamente o trigger que recalcula freights
  ALTER TABLE freight_assignments DISABLE TRIGGER update_freight_accepted_trucks_trigger;
  
  -- Atualizar cada assignment
  FOR v_idx IN 1..array_length(assignment_ids, 1) LOOP
    BEGIN
      UPDATE freight_assignments
      SET 
        status = freight_statuses[v_idx]::freight_status,
        updated_at = NOW()
      WHERE id = assignment_ids[v_idx];
      
      v_updated := v_updated + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'Failed to update assignment %: %', assignment_ids[v_idx], SQLERRM;
    END;
  END LOOP;
  
  -- Reabilitar o trigger
  ALTER TABLE freight_assignments ENABLE TRIGGER update_freight_accepted_trucks_trigger;
  
  RETURN jsonb_build_object(
    'updated', v_updated,
    'failed', v_failed,
    'total', array_length(assignment_ids, 1)
  );
END;
$$;