-- Corrigir fretes com status inconsistente
-- Atualizar fretes que foram confirmados mas status não foi atualizado
UPDATE freights
SET 
  status = 'COMPLETED',
  updated_at = NOW()
WHERE 
  status IN ('OPEN', 'ACCEPTED', 'IN_TRANSIT')
  AND (
    (metadata->>'delivery_confirmed_at') IS NOT NULL
    OR (metadata->>'confirmed_by_producer')::boolean = true
    OR (metadata->>'confirmed_by_producer_at') IS NOT NULL
    OR (metadata->>'delivery_confirmed_by_producer')::boolean = true
  );

-- Criar função RPC para correção em massa (útil para admin)
CREATE OR REPLACE FUNCTION fix_freight_statuses()
RETURNS TABLE (
  freight_id UUID,
  old_status TEXT,
  new_status TEXT
) AS $$
DECLARE
  updated_row RECORD;
BEGIN
  FOR updated_row IN
    UPDATE freights
    SET 
      status = 'COMPLETED',
      updated_at = NOW()
    WHERE 
      status IN ('OPEN', 'ACCEPTED', 'IN_TRANSIT')
      AND (
        (metadata->>'delivery_confirmed_at') IS NOT NULL
        OR (metadata->>'confirmed_by_producer')::boolean = true
        OR (metadata->>'confirmed_by_producer_at') IS NOT NULL
        OR (metadata->>'delivery_confirmed_by_producer')::boolean = true
      )
    RETURNING 
      id,
      'COMPLETED' AS new_status,
      status AS old_status
  LOOP
    freight_id := updated_row.id;
    new_status := updated_row.new_status;
    old_status := updated_row.old_status;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;