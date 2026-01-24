-- Drop and recreate service_requests_secure view with correct logic
-- The issue: client_id and provider_id are PROFILE IDs, not USER IDs
-- We need to check if the current user owns the client_id or provider_id profile

DROP VIEW IF EXISTS service_requests_secure;

CREATE OR REPLACE VIEW service_requests_secure 
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
    
    -- Check if current user is the client, the assigned provider, or admin
    -- Contact info is ONLY revealed if:
    -- 1. User is the client (owns client_id profile)
    -- 2. User is the ASSIGNED provider (provider_id is set AND matches user's profile)
    -- 3. User is admin
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

-- Grant access to the secure view
GRANT SELECT ON service_requests_secure TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW service_requests_secure IS 'Secure view that masks contact PII. Shows full data only to: (1) client who created request, (2) ASSIGNED provider (after acceptance), (3) admins. Providers browsing open requests see masked data only.';