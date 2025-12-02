-- ========================================
-- MIGRATION: FIX RLS POLICIES - REPLACE profiles.role WITH has_role()
-- ========================================
-- This migration updates all RLS policies that check profiles.role = 'ADMIN'
-- to use the has_role() function with user_roles table instead.
--
-- Affected tables:
-- - freights
-- - antt_recalculation_history
-- - service_requests
-- ========================================

-- ============ TABLE: freights ============
-- Add admin policy using has_role() function
DO $$ 
BEGIN
  -- Check if policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'freights' 
    AND policyname = 'Admins can view all freights'
  ) THEN
    CREATE POLICY "Admins can view all freights" ON freights
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'freights' 
    AND policyname = 'Admins can update all freights'
  ) THEN
    CREATE POLICY "Admins can update all freights" ON freights
    FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'freights' 
    AND policyname = 'Admins can delete all freights'
  ) THEN
    CREATE POLICY "Admins can delete all freights" ON freights
    FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ============ TABLE: antt_recalculation_history ============
-- Drop old policy if exists and create new one
DROP POLICY IF EXISTS "Admin can view recalculation history" ON antt_recalculation_history;
DROP POLICY IF EXISTS "Allow admin access" ON antt_recalculation_history;

CREATE POLICY "Admins can view recalculation history" ON antt_recalculation_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert recalculation history" ON antt_recalculation_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ TABLE: service_requests ============
-- Add admin policies using has_role()
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_requests' 
    AND policyname = 'Admins can view all service requests'
  ) THEN
    CREATE POLICY "Admins can view all service requests" ON service_requests
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_requests' 
    AND policyname = 'Admins can update all service requests'
  ) THEN
    CREATE POLICY "Admins can update all service requests" ON service_requests
    FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_requests' 
    AND policyname = 'Admins can delete all service requests'
  ) THEN
    CREATE POLICY "Admins can delete all service requests" ON service_requests
    FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- ========================================
-- VERIFICATION QUERY
-- Run this to verify policies were updated correctly:
-- 
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('freights', 'antt_recalculation_history', 'service_requests')
-- AND (qual LIKE '%has_role%' OR qual LIKE '%profiles.role%')
-- ORDER BY tablename, policyname;
-- ========================================