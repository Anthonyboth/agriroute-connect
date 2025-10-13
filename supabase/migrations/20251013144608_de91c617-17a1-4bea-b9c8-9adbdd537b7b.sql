-- Fix RLS infinite recursion between freights and freight_assignments by removing cross-table reference from assignments policy
-- 1) Create SECURITY DEFINER helper to check if current user is producer of a given freight without relying on assignments policy
CREATE OR REPLACE FUNCTION public.is_current_user_producer_of_freight(p_freight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.profiles p ON p.id = f.producer_id
    WHERE f.id = p_freight_id
      AND p.user_id = auth.uid()
  );
$$;

-- 2) Replace assignments SELECT policy to avoid referencing freights directly (breaks recursion)
DROP POLICY IF EXISTS "Drivers and producers can view assignments" ON public.freight_assignments;

CREATE POLICY "Drivers and producers can view assignments"
ON public.freight_assignments
FOR SELECT
TO authenticated
USING (
  -- Driver sees their own assignments
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  -- Producer of the freight sees assignments (via SECURITY DEFINER function)
  OR public.is_current_user_producer_of_freight(freight_id)
  -- Admins see all
  OR is_admin()
);
