-- ==============================================================================
-- PHASE 4: FIX RLS POLICIES REGRESSION
-- Remove profiles.role checks and replace with has_role() from user_roles
-- ==============================================================================

-- Create RPC function to scan for policy violations
CREATE OR REPLACE FUNCTION scan_policies_for_role_references()
RETURNS TABLE (
  object_type TEXT,
  object_name TEXT,
  violation_type TEXT,
  violation_details TEXT,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Scan policies for profiles.role references
  RETURN QUERY
  SELECT 
    'POLICY'::TEXT,
    schemaname || '.' || tablename || '.' || policyname,
    'PROFILES_ROLE_CHECK'::TEXT,
    qual::TEXT,
    'Replace with: public.has_role(auth.uid(), ''admin''::app_role)'::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual LIKE '%profiles.role%'
      OR with_check LIKE '%profiles.role%'
    );

  -- Scan functions for profiles.role references
  RETURN QUERY
  SELECT
    'FUNCTION'::TEXT,
    n.nspname || '.' || p.proname,
    'PROFILES_ROLE_CHECK'::TEXT,
    substring(pg_get_functiondef(p.oid) from 1 for 200)::TEXT,
    'Review function and replace profiles.role checks with has_role()'::TEXT
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND pg_get_functiondef(p.oid) LIKE '%profiles.role%'
    AND p.proname NOT LIKE 'scan_policies%';
END;
$$;

-- 1. FREIGHTS TABLE - Fix policies
DROP POLICY IF EXISTS "role_motorista_transportadora_view_freights" ON freights;
DROP POLICY IF EXISTS "role_produtor_view_freights" ON freights;
DROP POLICY IF EXISTS "role_admin_view_all_freights" ON freights;

CREATE POLICY "Admins can view all freights"
ON freights FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Drivers and transport companies can view relevant freights"
ON freights FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA')
  )
  AND (
    status = 'OPEN'
    OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR id IN (
      SELECT freight_id FROM freight_assignments 
      WHERE driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND status = 'ACCEPTED'
    )
  )
);

CREATE POLICY "Producers can view their freights"
ON freights FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'PRODUTOR'
  )
  AND producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- 2. SERVICE_REQUESTS TABLE
DROP POLICY IF EXISTS "role_admin_view_all_services" ON service_requests;

CREATE POLICY "Admins can view all service requests"
ON service_requests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. ANTT_RECALCULATION_HISTORY TABLE
DROP POLICY IF EXISTS "Admins can view recalculation history" ON antt_recalculation_history;

CREATE POLICY "Admins can view antt recalculation history"
ON antt_recalculation_history FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. FREIGHTS_WEIGHT_BACKUP TABLE
DROP POLICY IF EXISTS "Apenas admins podem ver backup de pesos" ON freights_weight_backup;

CREATE POLICY "Admins can view weight backup"
ON freights_weight_backup FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON FUNCTION scan_policies_for_role_references IS 
'Scan all policies and functions for profiles.role references that should use has_role() instead';