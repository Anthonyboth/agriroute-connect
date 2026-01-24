
-- ============================================================
-- FIX: service_requests_contact_exposure
-- Revoke direct SELECT on base table, force use of secure view
-- ============================================================

-- 1. Drop and recreate the secure view with security_invoker
DROP VIEW IF EXISTS service_requests_secure;

CREATE VIEW service_requests_secure 
WITH (security_invoker = true) AS
SELECT 
    sr.id,
    sr.client_id,
    sr.provider_id,
    sr.service_type,
    sr.status,
    sr.urgency,
    sr.is_emergency,
    sr.preferred_datetime,
    sr.created_at,
    sr.updated_at,
    sr.accepted_at,
    sr.completed_at,
    sr.cancelled_at,
    sr.cancellation_reason,
    sr.location_city,
    sr.location_state,
    sr.city_name,
    sr.city_id,
    sr.state,
    sr.location_lat,
    sr.location_lng,
    sr.city_lat,
    sr.city_lng,
    sr.service_radius_km,
    sr.problem_description,
    sr.additional_info,
    sr.vehicle_info,
    sr.estimated_price,
    sr.final_price,
    sr.client_rating,
    sr.provider_rating,
    sr.client_comment,
    sr.provider_comment,
    sr.provider_notes,
    sr.reference_number,
    sr.prospect_user_id,
    -- Mask contact info: only visible to client owner, assigned provider, or admin
    CASE
        WHEN (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.client_id AND p.user_id = auth.uid())
            OR (sr.provider_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.provider_id AND p.user_id = auth.uid()))
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN sr.contact_name
        ELSE CONCAT(LEFT(COALESCE(sr.contact_name, ''), 2), '***')
    END AS contact_name,
    CASE
        WHEN (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.client_id AND p.user_id = auth.uid())
            OR (sr.provider_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.provider_id AND p.user_id = auth.uid()))
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN sr.contact_phone
        ELSE CONCAT('(**)*****-', RIGHT(COALESCE(sr.contact_phone, '0000'), 4))
    END AS contact_phone,
    CASE
        WHEN (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.client_id AND p.user_id = auth.uid())
            OR (sr.provider_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.provider_id AND p.user_id = auth.uid()))
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN sr.contact_email
        WHEN sr.contact_email IS NOT NULL THEN CONCAT(LEFT(SPLIT_PART(sr.contact_email, '@', 1), 2), '***@', SPLIT_PART(sr.contact_email, '@', 2))
        ELSE NULL
    END AS contact_email,
    CASE
        WHEN (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.client_id AND p.user_id = auth.uid())
            OR (sr.provider_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.provider_id AND p.user_id = auth.uid()))
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN sr.contact_document
        ELSE '***.***.***-**'
    END AS contact_document,
    CASE
        WHEN (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.client_id AND p.user_id = auth.uid())
            OR (sr.provider_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = sr.provider_id AND p.user_id = auth.uid()))
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN sr.location_address
        ELSE CONCAT(LEFT(COALESCE(sr.location_address, ''), 15), '...')
    END AS location_address
FROM service_requests sr;

-- 2. Grant SELECT on secure view to authenticated users
GRANT SELECT ON service_requests_secure TO authenticated;

-- 3. Revoke SELECT on base table from authenticated/anon
-- This forces all reads to go through the secure view
REVOKE SELECT ON service_requests FROM authenticated;
REVOKE SELECT ON service_requests FROM anon;

-- 4. Keep INSERT/UPDATE permissions for RLS-controlled operations
-- INSERT is controlled by RLS policies for edge functions/authenticated users
-- UPDATE is controlled by RLS policies for providers accepting requests

-- 5. Add comment explaining the security architecture
COMMENT ON VIEW service_requests_secure IS 'Secure view for service_requests with PII masking. Contact info (name, phone, email, document, address) is only visible to: (1) the client who owns the request, (2) the assigned provider, (3) administrators. All other users see masked data. This view uses security_invoker=true to respect RLS policies.';
