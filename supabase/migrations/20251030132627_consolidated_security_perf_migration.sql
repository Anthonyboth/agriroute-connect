-- Consolidated Security Hardening Migration
-- Prevents role self-elevation, ensures RLS, adds indices for performance

-- ============================================================================
-- PART 1: Prevent Role Self-Modification (Security Critical)
-- ============================================================================

-- Create trigger function to prevent users from elevating their own roles
CREATE OR REPLACE FUNCTION prevent_role_self_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role to modify any role
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Block role changes when user is modifying their own profile
  IF OLD.user_id = auth.uid() AND OLD.role != NEW.role THEN
    RAISE EXCEPTION 'Você não pode alterar sua própria função (role)';
  END IF;
  
  -- Block active_mode changes that would grant TRANSPORTADORA privileges improperly
  IF OLD.user_id = auth.uid() AND 
     OLD.role != 'TRANSPORTADORA' AND 
     NEW.active_mode = 'TRANSPORTADORA' THEN
    RAISE EXCEPTION 'Você não pode ativar modo TRANSPORTADORA sem a função apropriada';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_role_self_modification_trigger ON profiles;

-- Create trigger on profiles table
CREATE TRIGGER prevent_role_self_modification_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_modification();

COMMENT ON FUNCTION prevent_role_self_modification() IS
'Prevents users from elevating their own role. Only service_role can modify roles.';

-- ============================================================================
-- PART 2: Performance Indices
-- ============================================================================

-- Freights table indices for common queries
CREATE INDEX IF NOT EXISTS idx_freights_assigned_company_status 
  ON freights(assigned_company_id, status) 
  WHERE assigned_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_freights_driver_status 
  ON freights(driver_profile_id, status) 
  WHERE driver_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_freights_producer_status 
  ON freights(producer_id, status);

CREATE INDEX IF NOT EXISTS idx_freights_status_created 
  ON freights(status, created_at DESC);

-- Vehicles table indices
CREATE INDEX IF NOT EXISTS idx_vehicles_company_active 
  ON vehicles(company_id, active) 
  WHERE active = true;

-- Notifications table indices
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, read_at DESC) 
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);

-- Freight documents table indices
CREATE INDEX IF NOT EXISTS idx_freight_documents_freight 
  ON freight_documents(freight_id, created_at DESC);

-- Vehicle documents table indices  
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle 
  ON vehicle_documents(vehicle_id, created_at DESC);

-- Freight assignments table indices
CREATE INDEX IF NOT EXISTS idx_freight_assignments_driver_status 
  ON freight_assignments(driver_id, status) 
  WHERE status NOT IN ('REJECTED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_freight_assignments_freight_status 
  ON freight_assignments(freight_id, status);

-- User roles table index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
  ON user_roles(user_id);

COMMENT ON INDEX idx_freights_assigned_company_status IS
'Optimizes company dashboard queries for assigned freights';

COMMENT ON INDEX idx_notifications_user_read IS
'Optimizes unread notification queries';

-- ============================================================================
-- PART 3: Cities Table Security
-- ============================================================================

-- Add constraints to cities table if not exists
DO $$
BEGIN
  -- State code constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cities_state_code_check'
  ) THEN
    ALTER TABLE cities 
      ADD CONSTRAINT cities_state_code_check 
      CHECK (length(state_code) = 2);
  END IF;

  -- Country code constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cities_country_code_check'
  ) THEN
    ALTER TABLE cities 
      ADD CONSTRAINT cities_country_code_check 
      CHECK (country_code IN ('BR', 'PY', 'AR', 'UY', 'BO'));
  END IF;
END $$;

-- Create normalized unique index on cities (prevents duplicate entries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_normalized_unique
  ON cities(
    LOWER(TRIM(name)),
    LOWER(TRIM(state_code)),
    LOWER(TRIM(country_code))
  );

-- Enable RLS on cities table if not already enabled
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS cities_select_all ON cities;
DROP POLICY IF EXISTS cities_insert_admin_only ON cities;
DROP POLICY IF EXISTS cities_update_admin_only ON cities;
DROP POLICY IF EXISTS cities_delete_admin_only ON cities;

-- Allow anyone to read cities
CREATE POLICY cities_select_all 
  ON cities FOR SELECT 
  TO authenticated, anon
  USING (true);

-- Only admins can insert/update/delete cities
CREATE POLICY cities_insert_admin_only 
  ON cities FOR INSERT 
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY cities_update_admin_only 
  ON cities FOR UPDATE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY cities_delete_admin_only 
  ON cities FOR DELETE 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- PART 4: Spatial Reference System Security
-- ============================================================================

-- Enable RLS on spatial_ref_sys
ALTER TABLE spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS spatial_ref_sys_select_all ON spatial_ref_sys;

-- Allow SELECT for authenticated users and service_role
CREATE POLICY spatial_ref_sys_select_all 
  ON spatial_ref_sys FOR SELECT 
  TO authenticated, service_role
  USING (true);

-- No INSERT/UPDATE/DELETE policies - only PostGIS should modify this table

COMMENT ON TABLE spatial_ref_sys IS
'PostGIS spatial reference systems. Read-only for application users.';

-- ============================================================================
-- PART 5: Rate Limiting Infrastructure
-- ============================================================================

-- Create rate_limit_log table if not exists
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user_id
  endpoint TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE
);

-- Index for rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_identifier_endpoint_timestamp
  ON rate_limit_log(identifier, endpoint, timestamp DESC);

-- Cleanup old rate limit logs (keep only last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limit_log 
  WHERE timestamp < NOW() - INTERVAL '24 hours';
END;
$$;

-- Create rate limit check function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_count INTEGER;
BEGIN
  -- Count requests in the time window
  SELECT COUNT(*)
  INTO v_request_count
  FROM rate_limit_log
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND timestamp > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Log this request
  INSERT INTO rate_limit_log (identifier, endpoint, timestamp, blocked)
  VALUES (p_identifier, p_endpoint, NOW(), v_request_count >= p_max_requests);
  
  -- Return true if under limit, false if blocked
  RETURN v_request_count < p_max_requests;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;

COMMENT ON FUNCTION check_rate_limit IS
'Check if request is within rate limit. Returns true if allowed, false if blocked.';

-- ============================================================================
-- PART 6: User Settings Table (Secure localStorage Replacement)
-- ============================================================================

-- Create user_settings table for secure preferences storage
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active_company_id UUID REFERENCES transport_companies(id) ON DELETE SET NULL,
  active_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
DROP POLICY IF EXISTS user_settings_select_own ON user_settings;
DROP POLICY IF EXISTS user_settings_insert_own ON user_settings;
DROP POLICY IF EXISTS user_settings_update_own ON user_settings;
DROP POLICY IF EXISTS user_settings_delete_own ON user_settings;

CREATE POLICY user_settings_select_own 
  ON user_settings FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_settings_insert_own 
  ON user_settings FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_update_own 
  ON user_settings FOR UPDATE 
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_delete_own 
  ON user_settings FOR DELETE 
  TO authenticated
  USING (user_id = auth.uid());

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id 
  ON user_settings(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_settings_updated_at_trigger ON user_settings;

CREATE TRIGGER update_user_settings_updated_at_trigger
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

COMMENT ON TABLE user_settings IS
'Secure user preferences storage. Replaces sensitive localStorage data.';

-- ============================================================================
-- PART 7: Enhanced Freight Status RPC with Validation
-- ============================================================================

-- Update the existing driver_update_freight_status to include transition validation
CREATE OR REPLACE FUNCTION driver_update_freight_status(
  p_freight_id UUID,
  p_new_status TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_assignment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_producer_id UUID;
  v_driver_id UUID;
  v_company_id UUID;
  v_valid_transition BOOLEAN;
BEGIN
  -- Get current freight data
  SELECT status, producer_id, driver_id, company_id
  INTO v_current_status, v_producer_id, v_driver_id, v_company_id
  FROM freights
  WHERE id = p_freight_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Frete não encontrado'
    );
  END IF;

  -- Prevent status regression from final statuses
  IF v_current_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Não é possível alterar status de frete finalizado',
      'current_status', v_current_status,
      'attempted_status', p_new_status
    );
  END IF;

  -- Validate transition based on current status
  v_valid_transition := CASE v_current_status
    WHEN 'OPEN' THEN p_new_status IN ('IN_NEGOTIATION', 'ACCEPTED', 'REJECTED', 'CANCELLED')
    WHEN 'IN_NEGOTIATION' THEN p_new_status IN ('ACCEPTED', 'REJECTED', 'CANCELLED')
    WHEN 'ACCEPTED' THEN p_new_status IN ('LOADING', 'CANCELLED')
    WHEN 'LOADING' THEN p_new_status IN ('LOADED', 'CANCELLED')
    WHEN 'LOADED' THEN p_new_status IN ('IN_TRANSIT', 'CANCELLED')
    WHEN 'IN_TRANSIT' THEN p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'CANCELLED')
    WHEN 'DELIVERED_PENDING_CONFIRMATION' THEN p_new_status IN ('DELIVERED', 'COMPLETED')
    WHEN 'DELIVERED' THEN p_new_status = 'COMPLETED'
    WHEN 'PENDING' THEN p_new_status IN ('OPEN', 'IN_NEGOTIATION', 'CANCELLED')
    ELSE false
  END;

  IF NOT v_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TRANSITION_NOT_ALLOWED',
      'message', format('Transição de %s para %s não permitida', v_current_status, p_new_status),
      'current_status', v_current_status,
      'attempted_status', p_new_status
    );
  END IF;

  -- Update freight status
  UPDATE freights
  SET 
    status = p_new_status,
    updated_at = NOW()
  WHERE id = p_freight_id;

  -- Sync assignment status if assignment_id provided
  IF p_assignment_id IS NOT NULL THEN
    UPDATE freight_assignments
    SET 
      status = p_new_status,
      updated_at = NOW()
    WHERE id = p_assignment_id;
  END IF;

  -- Insert check-in record with error handling
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    BEGIN
      INSERT INTO freight_checkins (
        freight_id,
        user_id,
        status,
        location_lat,
        location_lng,
        notes,
        created_at
      ) VALUES (
        p_freight_id,
        p_user_id,
        p_new_status,
        p_lat,
        p_lng,
        p_notes,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      INSERT INTO audit_logs (
        table_name,
        operation,
        new_data,
        user_id,
        created_at
      ) VALUES (
        'freight_checkins',
        'INSERT_ERROR',
        jsonb_build_object('error', SQLERRM, 'freight_id', p_freight_id),
        p_user_id,
        NOW()
      );
    END;
  END IF;

  -- Log status change
  INSERT INTO freight_status_history (
    freight_id,
    status,
    changed_by,
    notes,
    location_lat,
    location_lng,
    created_at
  ) VALUES (
    p_freight_id,
    p_new_status,
    p_user_id,
    p_notes,
    p_lat,
    p_lng,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'new_status', p_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION driver_update_freight_status TO authenticated;

COMMENT ON FUNCTION driver_update_freight_status IS
'Update freight status with transition validation and history tracking. SECURITY DEFINER.';

-- ============================================================================
-- PART 8: RPC for Company In-Progress Freights (Performance Optimization)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_inprogress_freights(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  cargo_type TEXT,
  origin_city TEXT,
  destination_city TEXT,
  status TEXT,
  price NUMERIC,
  distance_km NUMERIC,
  estimated_delivery_date DATE,
  driver_name TEXT,
  vehicle_plate TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Only return freights with driver/vehicle assigned and in-progress status
  RETURN QUERY
  SELECT
    f.id,
    f.cargo_type,
    f.origin_city,
    f.destination_city,
    f.status,
    f.price,
    f.distance_km,
    f.estimated_delivery_date,
    p.full_name as driver_name,
    v.license_plate as vehicle_plate,
    f.created_at,
    f.updated_at
  FROM freights f
  LEFT JOIN profiles p ON f.driver_profile_id = p.id
  LEFT JOIN vehicles v ON f.vehicle_id = v.id
  WHERE f.assigned_company_id = p_company_id
    AND f.driver_profile_id IS NOT NULL
    AND f.vehicle_id IS NOT NULL
    AND f.status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
  ORDER BY f.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_company_inprogress_freights TO authenticated;

COMMENT ON FUNCTION get_company_inprogress_freights IS
'Get in-progress freights for a company (with driver and vehicle assigned). Optimized for dashboard.';
