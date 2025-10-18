-- ============================================
-- FIX 1: Remove SECURITY DEFINER from Views
-- ============================================
-- First, identify the problematic views
DO $$
DECLARE
  view_record RECORD;
BEGIN
  -- Find all views with SECURITY DEFINER in the public schema
  FOR view_record IN 
    SELECT schemaname, viewname, definition
    FROM pg_views 
    WHERE schemaname = 'public'
    AND definition ILIKE '%SECURITY DEFINER%'
  LOOP
    RAISE NOTICE 'Found SECURITY DEFINER view: %.%', view_record.schemaname, view_record.viewname;
    
    -- Drop and recreate without SECURITY DEFINER
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', view_record.schemaname, view_record.viewname);
    
    -- Recreate view without SECURITY DEFINER
    -- Remove the SECURITY DEFINER clause from definition
    EXECUTE regexp_replace(view_record.definition, 'SECURITY DEFINER\s*', '', 'gi');
  END LOOP;
END $$;

-- ============================================
-- FIX 2: Restrict freight_payment_deadlines Access
-- ============================================
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Users can view their payment deadlines" ON freight_payment_deadlines;

-- Create new restrictive policy: Only freight participants can see their deadlines
CREATE POLICY "Only freight participants see payment deadlines"
ON freight_payment_deadlines
FOR SELECT
USING (
  -- User is the producer of the freight
  freight_id IN (
    SELECT f.id 
    FROM freights f
    JOIN profiles p ON f.producer_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR
  -- User is the driver of the freight
  freight_id IN (
    SELECT f.id 
    FROM freights f
    JOIN profiles p ON f.driver_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR
  -- User is an admin
  is_admin()
);

-- Ensure RLS is enabled on the table
ALTER TABLE freight_payment_deadlines ENABLE ROW LEVEL SECURITY;

-- Add audit logging comment
COMMENT ON POLICY "Only freight participants see payment deadlines" ON freight_payment_deadlines IS 
'Security fix: Restricts payment deadline visibility to only freight producer, driver, or admins. Prevents competitors from viewing pricing strategies.';