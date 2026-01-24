-- Drop existing insecure view
DROP VIEW IF EXISTS freight_payments_secure;

-- Recreate secure view with proper security invoker and RLS respect
CREATE VIEW freight_payments_secure WITH (security_invoker = true) AS
SELECT 
    fp.id,
    fp.freight_id,
    fp.payer_id,
    fp.receiver_id,
    fp.amount,
    fp.payment_type,
    fp.payment_method,
    fp.status,
    fp.completed_at,
    fp.created_at,
    fp.updated_at,
    -- Always mask Stripe IDs - these should never be exposed to clients
    CASE 
        WHEN fp.stripe_payment_intent_id IS NOT NULL 
        THEN 'pi_****' || RIGHT(fp.stripe_payment_intent_id, 4)
        ELSE NULL 
    END AS stripe_payment_intent_masked,
    CASE 
        WHEN fp.stripe_session_id IS NOT NULL 
        THEN 'cs_****' || RIGHT(fp.stripe_session_id, 4)
        ELSE NULL 
    END AS stripe_session_masked,
    CASE 
        WHEN fp.external_transaction_id IS NOT NULL 
        THEN 'ext_****' || RIGHT(fp.external_transaction_id, 4)
        ELSE NULL 
    END AS external_transaction_masked
FROM freight_payments fp;

-- Grant access to the secure view
GRANT SELECT ON freight_payments_secure TO authenticated;

-- Revoke direct SELECT on base table from authenticated users
-- Only service_role should access base table directly
REVOKE SELECT ON freight_payments FROM authenticated;
REVOKE SELECT ON freight_payments FROM anon;

-- Keep INSERT permission for authenticated users (they create payments but use edge functions for processing)
-- The RLS policy still controls who can insert