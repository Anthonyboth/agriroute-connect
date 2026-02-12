
-- =====================================================
-- HARDENING: REVOKE SELECT em colunas PII da tabela profiles
-- Isso impede acesso direto mesmo com RLS permitindo a row
-- Acesso legítimo deve ser via profiles_secure view
-- =====================================================

-- 1. REVOKE SELECT em colunas sensíveis para authenticated e anon
REVOKE SELECT (cpf_cnpj) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (phone) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (contact_phone) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (document) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (emergency_contact_name) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (emergency_contact_phone) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_street) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_number) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_complement) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_neighborhood) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_city) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_state) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_zip) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (farm_address) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (fixed_address) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (rntrc) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (antt_number) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (selfie_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (document_photo_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (cnh_photo_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (truck_documents_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (truck_photo_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (license_plate_photo_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (address_proof_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (document_rg_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (document_cpf_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (cnh_url) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (cnh_expiry_date) ON public.profiles FROM authenticated, anon;
REVOKE SELECT (cnh_category) ON public.profiles FROM authenticated, anon;

-- 2. Recriar profiles_secure view com selfie_url também mascarado
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure AS
SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.status,
    p.rating,
    p.total_ratings,
    p.rating_sum,
    p.rating_locked,
    p.created_at,
    p.updated_at,
    p.profile_photo_url,
    p.service_types,
    p.base_city_name,
    p.base_state,
    p.aprovado,
    p.validation_status,
    p.current_city_name,
    p.current_state,
    p.active_mode,
    p.role,
    p.cooperative,
    p.farm_name,
    p.service_regions,
    p.service_radius_km,
    p.service_cities,
    p.service_states,
    p.location_enabled,
    p.vehicle_other_type,
    p.vehicle_specifications,
    p.live_cargo_experience,
    p.base_lat,
    p.base_lng,
    p.base_city_id,
    p.metadata,
    -- Campos PII mascarados: só dono e admin veem
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.cpf_cnpj ELSE '***' END AS cpf_cnpj,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.phone ELSE NULL END AS phone,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.contact_phone ELSE NULL END AS contact_phone,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.email ELSE NULL END AS email,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.document ELSE NULL END AS document,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.rntrc ELSE NULL END AS rntrc,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.antt_number ELSE NULL END AS antt_number,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.emergency_contact_name ELSE NULL END AS emergency_contact_name,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.emergency_contact_phone ELSE NULL END AS emergency_contact_phone,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_street ELSE NULL END AS address_street,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_number ELSE NULL END AS address_number,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_complement ELSE NULL END AS address_complement,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_neighborhood ELSE NULL END AS address_neighborhood,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_city ELSE NULL END AS address_city,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_state ELSE NULL END AS address_state,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_zip ELSE NULL END AS address_zip,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.farm_address ELSE NULL END AS farm_address,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.fixed_address ELSE NULL END AS fixed_address,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.selfie_url ELSE NULL END AS selfie_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.document_photo_url ELSE NULL END AS document_photo_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.cnh_photo_url ELSE NULL END AS cnh_photo_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.truck_documents_url ELSE NULL END AS truck_documents_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.truck_photo_url ELSE NULL END AS truck_photo_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.license_plate_photo_url ELSE NULL END AS license_plate_photo_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.address_proof_url ELSE NULL END AS address_proof_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.document_rg_url ELSE NULL END AS document_rg_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.document_cpf_url ELSE NULL END AS document_cpf_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.cnh_url ELSE NULL END AS cnh_url,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.cnh_expiry_date ELSE NULL END AS cnh_expiry_date,
    CASE WHEN (p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) THEN p.cnh_category ELSE NULL END AS cnh_category,
    p.document_validation_status,
    p.cnh_validation_status,
    p.rntrc_validation_status,
    p.validation_notes,
    p.background_check_status,
    p.validated_at,
    p.validated_by,
    p.invoice_number,
    p.address_city_id
FROM public.profiles p;

-- 3. Garantir que a view é acessível via RLS da tabela base
GRANT SELECT ON public.profiles_secure TO authenticated;
