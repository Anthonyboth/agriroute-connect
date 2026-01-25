-- ============================================
-- P0 HOTFIX: Create current_profile_id() alias
-- Reason: RPCs call current_profile_id() but only get_current_profile_id() exists
-- ============================================

-- Drop if exists to recreate cleanly
DROP FUNCTION IF EXISTS public.current_profile_id();

-- Create the alias function
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_current_profile_id();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO service_role;

COMMENT ON FUNCTION public.current_profile_id IS 'P0 HOTFIX: Alias for get_current_profile_id() to fix "function does not exist" errors in production';

-- ============================================
-- P0 HOTFIX: Fix vehicles RLS policies for license plate exposure
-- Remove broad company access for sensitive vehicle data
-- ============================================

-- First drop the overly permissive policies
DROP POLICY IF EXISTS "Drivers e Transportadoras podem ver veículos" ON public.vehicles;
DROP POLICY IF EXISTS "Transportadoras e Motoristas podem gerenciar veículos" ON public.vehicles;

-- Create stricter SELECT policy - only owner, assigned driver, or admin
CREATE POLICY "vehicles_select_owner_or_assigned"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  -- Owner can see their own vehicles
  driver_id = public.get_current_profile_id()
  OR
  -- Assigned driver can see assigned vehicle
  assigned_driver_id = public.get_current_profile_id()
  OR
  -- Company owner can see company vehicles (but they own the company)
  (
    company_id IS NOT NULL 
    AND company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = public.get_current_profile_id()
    )
  )
  OR
  -- Admin can see all
  public.is_admin()
);

-- Create stricter UPDATE policy
CREATE POLICY "vehicles_update_owner_or_company_owner"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (
  driver_id = public.get_current_profile_id()
  OR
  (
    company_id IS NOT NULL 
    AND company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = public.get_current_profile_id()
    )
  )
);

-- Create stricter DELETE policy
DROP POLICY IF EXISTS "Drivers can delete their own vehicles" ON public.vehicles;
CREATE POLICY "vehicles_delete_owner"
ON public.vehicles
FOR DELETE
TO authenticated
USING (
  driver_id = public.get_current_profile_id()
  OR
  (
    company_id IS NOT NULL 
    AND company_id IN (
      SELECT id FROM transport_companies 
      WHERE profile_id = public.get_current_profile_id()
    )
  )
  OR
  public.is_admin()
);

-- Ensure INSERT policy exists
DROP POLICY IF EXISTS "Drivers can insert their own vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Motoristas can create their own vehicles" ON public.vehicles;
CREATE POLICY "vehicles_insert_owner"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  driver_id = public.get_current_profile_id()
);