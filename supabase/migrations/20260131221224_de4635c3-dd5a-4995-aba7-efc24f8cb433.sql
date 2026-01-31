-- Fix RLS infinite recursion: avoid referencing public.profiles directly inside company_drivers policies
-- The profiles RLS policy `profiles_select_affiliated_drivers` queries company_drivers.
-- company_drivers policies were querying profiles again, causing a recursion loop (42P17).

-- 1) Helper: get current user's profile ids without enforcing RLS (safe inside policies)
CREATE OR REPLACE FUNCTION public.get_my_profile_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(array_agg(p.id), '{}'::uuid[])
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

-- 2) Replace company_drivers policies to remove direct subqueries against public.profiles
--    (keep semantics as close as possible to existing policies)

DROP POLICY IF EXISTS "Motoristas podem sair da transportadora" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_select" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_insert" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_update" ON public.company_drivers;
DROP POLICY IF EXISTS "company_drivers_delete" ON public.company_drivers;

-- Drivers can update their own membership to leave company (ACTIVE -> INACTIVE)
CREATE POLICY "Motoristas podem sair da transportadora"
ON public.company_drivers
FOR UPDATE
TO authenticated
USING (
  driver_profile_id = ANY(public.get_my_profile_ids())
  AND status = 'ACTIVE'
)
WITH CHECK (
  driver_profile_id = ANY(public.get_my_profile_ids())
  AND status = 'INACTIVE'
);

-- Company owners (transport company) can see their driver memberships; drivers can see their own; admins can see all
CREATE POLICY "company_drivers_select"
ON public.company_drivers
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.transport_companies tc
    WHERE tc.id = company_drivers.company_id
      AND tc.profile_id = ANY(public.get_my_profile_ids())
  )
  OR driver_profile_id = ANY(public.get_my_profile_ids())
  OR is_admin()
);

-- Company owners can invite/insert driver memberships; drivers can create their own pending record; admins can insert
CREATE POLICY "company_drivers_insert"
ON public.company_drivers
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transport_companies tc
    WHERE tc.id = company_drivers.company_id
      AND tc.profile_id = ANY(public.get_my_profile_ids())
  )
  OR (
    driver_profile_id = ANY(public.get_my_profile_ids())
    AND status = 'PENDING'
  )
  OR is_admin()
);

-- Company owners can update driver memberships; admins can update
CREATE POLICY "company_drivers_update"
ON public.company_drivers
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.transport_companies tc
    WHERE tc.id = company_drivers.company_id
      AND tc.profile_id = ANY(public.get_my_profile_ids())
  )
  OR is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transport_companies tc
    WHERE tc.id = company_drivers.company_id
      AND tc.profile_id = ANY(public.get_my_profile_ids())
  )
  OR is_admin()
);

-- Company owners can delete driver memberships; admins can delete
CREATE POLICY "company_drivers_delete"
ON public.company_drivers
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.transport_companies tc
    WHERE tc.id = company_drivers.company_id
      AND tc.profile_id = ANY(public.get_my_profile_ids())
  )
  OR is_admin()
);
