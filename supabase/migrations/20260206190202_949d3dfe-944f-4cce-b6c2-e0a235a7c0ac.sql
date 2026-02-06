-- Fix: RLS policies on external_payments use has_role() which checks empty user_roles table
-- Must use profiles.role instead (where roles are actually stored as uppercase enums)

-- Drop old policies
DROP POLICY IF EXISTS "Producers can update their external payments" ON public.external_payments;
DROP POLICY IF EXISTS "Drivers can update external payments" ON public.external_payments;
DROP POLICY IF EXISTS "Producers can create external payments" ON public.external_payments;

-- Recreate producer UPDATE policy using profiles.role
CREATE POLICY "Producers can update their external payments"
ON public.external_payments
FOR UPDATE
USING (
  producer_id = get_my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'PRODUTOR'
  )
)
WITH CHECK (
  producer_id = get_my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'PRODUTOR'
  )
);

-- Recreate driver UPDATE policy using profiles.role
CREATE POLICY "Drivers can update external payments"
ON public.external_payments
FOR UPDATE
USING (
  driver_id = get_my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )
)
WITH CHECK (
  driver_id = get_my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('MOTORISTA', 'MOTORISTA_AFILIADO')
  )
);

-- Recreate producer INSERT policy using profiles.role
CREATE POLICY "Producers can create external payments"
ON public.external_payments
FOR INSERT
WITH CHECK (
  producer_id = get_my_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'PRODUTOR'
  )
);