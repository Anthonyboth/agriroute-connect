
-- Fix: RLS policy for transportadora viewing affiliated driver payments
-- The status column in company_drivers stores 'ACTIVE' (uppercase) but policy checked 'active' (lowercase)

DROP POLICY IF EXISTS "Companies can view affiliated drivers payments" ON public.external_payments;

CREATE POLICY "Companies can view affiliated drivers payments"
ON public.external_payments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_drivers cd
    JOIN transport_companies tc ON tc.id = cd.company_id
    WHERE cd.driver_profile_id = external_payments.driver_id
    AND tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND UPPER(cd.status) = 'ACTIVE'
  )
);
