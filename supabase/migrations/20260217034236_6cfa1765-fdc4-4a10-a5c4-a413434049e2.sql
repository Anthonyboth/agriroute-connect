
-- Fix: Recriar service_requests_secure com suporte a transportadoras
-- A view foi dropada pela migration anterior que falhou, precisa recriar
CREATE OR REPLACE VIEW public.service_requests_secure
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
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
        ) THEN location_lat
        ELSE NULL::double precision
    END AS location_lat,
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
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
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
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
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
        ) THEN contact_phone
        ELSE '***-****'::text
    END AS contact_phone,
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
        ) THEN contact_email
        ELSE '***@***.***'::text
    END AS contact_email,
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
        ) THEN contact_name
        ELSE concat(left(contact_name, 3), '***')
    END AS contact_name,
    CASE
        WHEN (
            client_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR provider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
            OR has_role(auth.uid(), 'admin'::app_role)
            OR provider_id IN (
                SELECT cd.driver_profile_id FROM company_drivers cd
                JOIN transport_companies tc ON tc.id = cd.company_id
                WHERE tc.profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
                AND cd.status = 'active'
            )
        ) THEN contact_document
        ELSE NULL::text
    END AS contact_document
FROM public.service_requests;

GRANT SELECT ON public.service_requests_secure TO anon, authenticated;

COMMENT ON VIEW public.service_requests_secure IS 'Secure view masking contact PII. Full data visible to: (1) client, (2) assigned provider, (3) admins, (4) carrier owners whose affiliated drivers are the provider.';
