-- ============================================================
-- Revoke direct SELECT on sensitive Stripe columns from
-- freight_payments for authenticated. Client reads go through
-- freight_payments_secure view. Edge functions use service_role.
-- ============================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their payments" ON public.freight_payments;

-- Revoke full SELECT
REVOKE SELECT ON public.freight_payments FROM authenticated;

-- Re-grant only non-sensitive columns
GRANT SELECT (id, freight_id, payer_id, receiver_id, amount, payment_type, payment_method, status, created_at, updated_at, completed_at) ON public.freight_payments TO authenticated;

-- Re-create owner SELECT policy (payer or receiver or admin)
CREATE POLICY "freight_payments_select_participants"
ON public.freight_payments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  payer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_admin()
);
