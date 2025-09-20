-- Fix infinite recursion in freights table RLS policies
-- The issue is in the complex policy that references functions and subqueries

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Drivers can view only matched freights" ON freights;

-- Create a simpler, non-recursive policy for drivers
CREATE POLICY "Drivers can view freights" ON freights
FOR SELECT 
USING (
  -- Drivers can see:
  -- 1. Open freights (available to propose)  
  -- 2. Freights assigned to them
  -- 3. Their own freights if they are also producers
  status = 'OPEN' OR 
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);

-- Also ensure drivers can update freights assigned to them
DROP POLICY IF EXISTS "Drivers can update their assigned freights" ON freights;
CREATE POLICY "Drivers can update their assigned freights" ON freights
FOR UPDATE
USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);