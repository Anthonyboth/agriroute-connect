-- Fix: allow drivers to INSERT freight proposals (counter-proposals/accept)
-- Root cause: freight_proposals had SELECT/UPDATE policies but no INSERT policy, causing RLS violations.

ALTER TABLE public.freight_proposals ENABLE ROW LEVEL SECURITY;

-- Replace policy safely
DROP POLICY IF EXISTS "Drivers can insert proposals for open freights" ON public.freight_proposals;

CREATE POLICY "Drivers can insert proposals for open freights"
ON public.freight_proposals
FOR INSERT
TO authenticated
WITH CHECK (
  -- must be the authenticated user's own profile
  driver_id = public.current_profile_id()

  -- must be a driver profile (motorista or motorista afiliado)
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = public.current_profile_id()
      AND p.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )

  -- must have a vehicle (own) OR a current company vehicle assignment
  AND (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.driver_id = public.current_profile_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_vehicle_assignments cva
      WHERE cva.driver_profile_id = public.current_profile_id()
        AND cva.removed_at IS NULL
    )
  )

  -- freight must be open for negotiation and still have remaining slots
  AND EXISTS (
    SELECT 1
    FROM public.freights f
    WHERE f.id = freight_proposals.freight_id
      AND f.producer_id IS NOT NULL
      AND COALESCE(f.is_guest_freight, false) = false
      AND f.status IN ('OPEN'::public.freight_status, 'IN_NEGOTIATION'::public.freight_status)
      AND f.accepted_trucks < f.required_trucks
  )
);
