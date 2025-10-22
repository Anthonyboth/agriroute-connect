-- ============================================================================
-- MIGRATION: Fix Driver Dashboard Critical Errors (v2 - handles existing policies)
-- Issues Fixed:
--   1. 42P17: Infinite recursion in transport_companies RLS policies
--   2. 42804: Type mismatch in get_freights_for_driver RPC (date vs timestamptz)
--   3. Missing driver_checkins table causing count errors
-- ============================================================================

-- ============================================================================
-- STEP 1: Create SECURITY DEFINER helper functions (bypass RLS safely)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_view_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.transport_companies tc
      JOIN public.profiles p ON p.id = tc.profile_id
      WHERE tc.id = _company_id AND p.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_drivers cd
      JOIN public.profiles p ON p.id = cd.driver_profile_id
      WHERE cd.company_id = _company_id
        AND cd.status = 'ACTIVE'
        AND p.user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.transport_companies tc
      JOIN public.profiles p ON p.id = tc.profile_id
      WHERE tc.id = _company_id AND p.user_id = _user_id
    );
$$;

-- ============================================================================
-- STEP 2: Drop ALL existing policies on transport_companies
-- ============================================================================

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transport_companies'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.transport_companies', pol.policyname);
  END LOOP;
END$$;

-- ============================================================================
-- STEP 3: Recreate minimal, safe policies for transport_companies
-- ============================================================================

CREATE POLICY companies_select
ON public.transport_companies
FOR SELECT
TO authenticated
USING (public.can_view_company(auth.uid(), id));

CREATE POLICY companies_update
ON public.transport_companies
FOR UPDATE
TO authenticated
USING (public.can_manage_company(auth.uid(), id))
WITH CHECK (public.can_manage_company(auth.uid(), id));

CREATE POLICY companies_insert
ON public.transport_companies
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_company(auth.uid(), id));

CREATE POLICY companies_delete
ON public.transport_companies
FOR DELETE
TO authenticated
USING (public.can_manage_company(auth.uid(), id));

-- ============================================================================
-- STEP 4: Drop ALL existing policies on company_drivers
-- ============================================================================

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_drivers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.company_drivers', pol.policyname);
  END LOOP;
END$$;

-- ============================================================================
-- STEP 5: Recreate safe policies for company_drivers
-- ============================================================================

CREATE POLICY company_drivers_select
ON public.company_drivers
FOR SELECT
TO authenticated
USING (
  public.can_manage_company(auth.uid(), company_id)
  OR driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY company_drivers_insert
ON public.company_drivers
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_company(auth.uid(), company_id) OR public.is_admin());

CREATE POLICY company_drivers_update
ON public.company_drivers
FOR UPDATE
TO authenticated
USING (public.can_manage_company(auth.uid(), company_id) OR public.is_admin())
WITH CHECK (public.can_manage_company(auth.uid(), company_id) OR public.is_admin());

CREATE POLICY company_drivers_delete
ON public.company_drivers
FOR DELETE
TO authenticated
USING (public.can_manage_company(auth.uid(), company_id) OR public.is_admin());

-- ============================================================================
-- STEP 6: Fix RPC type mismatch - get_freights_for_driver returns DATE
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_freights_for_driver(uuid);

CREATE OR REPLACE FUNCTION public.get_freights_for_driver(p_driver_id uuid)
RETURNS TABLE (
  id uuid,
  cargo_type text,
  weight numeric,
  origin_address text,
  destination_address text,
  pickup_date date,
  delivery_date date,
  price numeric,
  urgency text,
  status public.freight_status,
  service_type text,
  producer_id uuid,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status,
    f.service_type,
    f.producer_id,
    f.created_at
  FROM public.freights f
  WHERE f.status = 'OPEN'
    AND f.driver_id IS NULL
    AND (f.service_type IS NULL OR f.service_type IN ('FRETE','CARGA','MUDANCA_INDUSTRIAL','TRANSPORTE_ESPECIAL'))
  ORDER BY f.created_at DESC
  LIMIT 200;
$$;

-- ============================================================================
-- STEP 7: Drop existing policies on driver_checkins (if table exists)
-- ============================================================================

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_checkins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.driver_checkins', pol.policyname);
  END LOOP;
END$$;

-- ============================================================================
-- STEP 8: Create driver_checkins table with RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.driver_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid REFERENCES public.profiles(id) NOT NULL,
  freight_id uuid REFERENCES public.freights(id) NOT NULL,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.driver_checkins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 9: Create fresh policies for driver_checkins
-- ============================================================================

CREATE POLICY driver_checkins_select
ON public.driver_checkins
FOR SELECT
TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY driver_checkins_insert
ON public.driver_checkins
FOR INSERT
TO authenticated
WITH CHECK (
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.is_admin()
);

-- ============================================================================
-- STEP 10: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_driver_checkins_driver ON public.driver_checkins(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_driver_checkins_freight ON public.driver_checkins(freight_id);
CREATE INDEX IF NOT EXISTS idx_driver_checkins_checked_at ON public.driver_checkins(checked_at DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================