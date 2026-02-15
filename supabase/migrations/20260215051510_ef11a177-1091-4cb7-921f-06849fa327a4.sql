
-- =====================================================
-- 1. REVOGAR SELECT direto nas colunas PII da tabela service_requests
-- =====================================================
REVOKE SELECT (contact_phone, contact_name, contact_email, contact_document, location_lat, location_lng, location_address)
ON public.service_requests FROM anon;

REVOKE SELECT (contact_phone, contact_name, contact_email, contact_document, location_lat, location_lng, location_address)
ON public.service_requests FROM authenticated;

-- =====================================================
-- 2. DROP e RECRIAR a view service_requests_secure
--    Mantendo a mesma ordem de colunas original
--    Adicionando masking para location_lat, location_lng, location_address
-- =====================================================
DROP VIEW IF EXISTS public.service_requests_secure;

CREATE VIEW public.service_requests_secure
WITH (security_invoker = false)
AS
SELECT 
    id,
    service_type,
    status,
    created_at,
    updated_at,
    preferred_datetime,
    location_city,
    location_state,
    -- col 9: location_lat (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN location_lat
        ELSE NULL::double precision
    END AS location_lat,
    -- col 10: location_lng (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN location_lng
        ELSE NULL::double precision
    END AS location_lng,
    problem_description,
    additional_info,
    urgency,
    is_emergency,
    vehicle_info,
    estimated_price,
    final_price,
    accepted_at,
    completed_at,
    cancelled_at,
    cancellation_reason,
    client_id,
    provider_id,
    -- col 24: location_address (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN location_address
        ELSE COALESCE(city_name || ', ' || state, 'Localização não especificada')
    END AS location_address,
    reference_number,
    city_name,
    state,
    city_lat,
    city_lng,
    city_id,
    service_radius_km,
    provider_notes,
    client_rating,
    provider_rating,
    client_comment,
    provider_comment,
    -- col 37: contact_phone (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN contact_phone
        ELSE '***-****'::text
    END AS contact_phone,
    -- col 38: contact_email (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN contact_email
        ELSE '***@***.***'::text
    END AS contact_email,
    -- col 39: contact_name (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN contact_name
        ELSE concat(left(contact_name, 3), '***')
    END AS contact_name,
    -- col 40: contact_document (mascarado)
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
        ) THEN contact_document
        ELSE NULL::text
    END AS contact_document
FROM public.service_requests;

-- Garantir acesso à view
GRANT SELECT ON public.service_requests_secure TO anon, authenticated;
