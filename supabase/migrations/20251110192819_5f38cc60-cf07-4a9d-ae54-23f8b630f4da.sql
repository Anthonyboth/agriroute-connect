-- =============================================
-- FIX #1: user_devices RLS Policies
-- =============================================
DROP POLICY IF EXISTS "Users can insert their own devices" ON user_devices;
DROP POLICY IF EXISTS "Users can manage their devices" ON user_devices;
DROP POLICY IF EXISTS "users_can_insert_own_devices" ON user_devices;
DROP POLICY IF EXISTS "users_can_read_own_devices" ON user_devices;
DROP POLICY IF EXISTS "users_can_update_own_devices" ON user_devices;

-- Policy for INSERT
CREATE POLICY "users_can_insert_own_devices"
ON user_devices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Policy for SELECT
CREATE POLICY "users_can_read_own_devices"
ON user_devices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy for UPDATE
CREATE POLICY "users_can_update_own_devices"
ON user_devices
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FIX #2: freight_status_history RLS
-- =============================================
DROP POLICY IF EXISTS "Users can insert their own freight history" ON freight_status_history;
DROP POLICY IF EXISTS "Drivers can insert freight history" ON freight_status_history;
DROP POLICY IF EXISTS "drivers_can_insert_freight_status_history" ON freight_status_history;
DROP POLICY IF EXISTS "drivers_and_producers_can_read_freight_history" ON freight_status_history;

-- Policy for INSERT: allows direct drivers AND drivers with assignments
CREATE POLICY "drivers_can_insert_freight_status_history"
ON freight_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM freights
    WHERE id = freight_status_history.freight_id
    AND driver_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM freight_assignments
    WHERE freight_id = freight_status_history.freight_id
    AND driver_id = auth.uid()
    AND status = 'ACCEPTED'
  )
  OR
  changed_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM freights
    WHERE id = freight_status_history.freight_id
    AND producer_id = auth.uid()
  )
);

-- Policy for SELECT
CREATE POLICY "drivers_and_producers_can_read_freight_history"
ON freight_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM freights
    WHERE id = freight_status_history.freight_id
    AND driver_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM freight_assignments
    WHERE freight_id = freight_status_history.freight_id
    AND driver_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM freights
    WHERE id = freight_status_history.freight_id
    AND producer_id = auth.uid()
  )
);

ALTER TABLE freight_status_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FIX #3: Optimize driver_update_freight_status RPC
-- =============================================

-- Drop all existing versions
DO $$ 
DECLARE
  func_signature text;
BEGIN
  FOR func_signature IN 
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    WHERE p.proname = 'driver_update_freight_status'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_signature || ' CASCADE';
    RAISE NOTICE 'Dropped: %', func_signature;
  END LOOP;
END $$;

-- Create optimized function
CREATE OR REPLACE FUNCTION driver_update_freight_status(
  p_freight_id uuid,
  p_new_status text,
  p_user_id uuid,
  p_notes text DEFAULT NULL,
  p_location jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '5s'
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_driver_id uuid;
  v_has_permission boolean := false;
BEGIN
  SELECT status, driver_id 
  INTO v_old_status, v_driver_id
  FROM freights
  WHERE id = p_freight_id;
  
  IF v_old_status IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Frete não encontrado',
      'code', 'FREIGHT_NOT_FOUND'
    );
  END IF;
  
  IF v_driver_id = p_user_id THEN
    v_has_permission := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM freight_assignments
      WHERE freight_id = p_freight_id
      AND driver_id = p_user_id
      AND status = 'ACCEPTED'
      LIMIT 1
    ) INTO v_has_permission;
  END IF;
  
  IF NOT v_has_permission THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Você não tem permissão para atualizar este frete',
      'code', 'PERMISSION_DENIED'
    );
  END IF;
  
  UPDATE freights 
  SET 
    status = p_new_status::text,
    updated_at = now()
  WHERE id = p_freight_id;
  
  BEGIN
    INSERT INTO freight_status_history (
      freight_id,
      old_status,
      new_status,
      changed_by,
      notes,
      location,
      created_at
    ) VALUES (
      p_freight_id,
      v_old_status,
      p_new_status,
      p_user_id,
      p_notes,
      p_location,
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Erro ao inserir histórico (não bloqueante): %', SQLERRM;
  END;
  
  RETURN json_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'updated_at', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'UNKNOWN_ERROR'
    );
END;
$$;

COMMENT ON FUNCTION driver_update_freight_status IS 
'Atualiza status de frete (< 2s). Permite motoristas diretos e com assignments.';

-- =============================================
-- FIX #4: Create performance indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_freights_status_driver 
ON freights(status, driver_id) 
WHERE status NOT IN ('DELIVERED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_freights_id_status 
ON freights(id, status);

CREATE INDEX IF NOT EXISTS idx_freight_assignments_freight_driver_status 
ON freight_assignments(freight_id, driver_id, status) 
WHERE status = 'ACCEPTED';

CREATE INDEX IF NOT EXISTS idx_freight_status_history_freight_created 
ON freight_status_history(freight_id, created_at DESC);

-- Update statistics
ANALYZE freights;
ANALYZE freight_assignments;
ANALYZE freight_status_history;