
-- Update profiles_secure view to allow affiliated company owners to see driver photos
-- The WHERE clause already includes is_affiliated_driver_of_my_company(id),
-- but the CASE conditions for photo URLs only checked user_id = auth.uid() OR admin.
-- This adds the affiliation check so transport companies can see their drivers' photos.

CREATE OR REPLACE VIEW public.profiles_secure
WITH (security_invoker = false)
AS SELECT 
    id,
    user_id,
    full_name,
    status,
    rating,
    total_ratings,
    rating_sum,
    rating_locked,
    created_at,
    updated_at,
    profile_photo_url,
    service_types,
    base_city_name,
    base_state,
    aprovado,
    validation_status,
    current_city_name,
    current_state,
    active_mode,
    role,
    cooperative,
    farm_name,
    service_regions,
    service_radius_km,
    service_cities,
    service_states,
    location_enabled,
    vehicle_other_type,
    vehicle_specifications,
    live_cargo_experience,
    base_lat,
    base_lng,
    base_city_id,
    metadata,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN cpf_cnpj
        ELSE '***'::text
    END AS cpf_cnpj,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN phone
        ELSE NULL::text
    END AS phone,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN contact_phone
        ELSE NULL::text
    END AS contact_phone,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN email
        ELSE NULL::text
    END AS email,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN document
        ELSE NULL::text
    END AS document,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN rntrc
        ELSE NULL::text
    END AS rntrc,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN antt_number
        ELSE NULL::text
    END AS antt_number,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN emergency_contact_name
        ELSE NULL::text
    END AS emergency_contact_name,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN emergency_contact_phone
        ELSE NULL::text
    END AS emergency_contact_phone,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_street
        ELSE NULL::text
    END AS address_street,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_number
        ELSE NULL::text
    END AS address_number,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_complement
        ELSE NULL::text
    END AS address_complement,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_neighborhood
        ELSE NULL::text
    END AS address_neighborhood,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_city
        ELSE NULL::text
    END AS address_city,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_state
        ELSE NULL::text
    END AS address_state,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_zip
        ELSE NULL::text
    END AS address_zip,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN farm_address
        ELSE NULL::text
    END AS farm_address,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN fixed_address
        ELSE NULL::text
    END AS fixed_address,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN selfie_url
        ELSE NULL::text
    END AS selfie_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN document_photo_url
        ELSE NULL::text
    END AS document_photo_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN cnh_photo_url
        ELSE NULL::text
    END AS cnh_photo_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN truck_documents_url
        ELSE NULL::text
    END AS truck_documents_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN truck_photo_url
        ELSE NULL::text
    END AS truck_photo_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN license_plate_photo_url
        ELSE NULL::text
    END AS license_plate_photo_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN address_proof_url
        ELSE NULL::text
    END AS address_proof_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN document_rg_url
        ELSE NULL::text
    END AS document_rg_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN document_cpf_url
        ELSE NULL::text
    END AS document_cpf_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN cnh_url
        ELSE NULL::text
    END AS cnh_url,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN cnh_expiry_date
        ELSE NULL::date
    END AS cnh_expiry_date,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN cnh_category
        ELSE NULL::text
    END AS cnh_category,
    document_validation_status,
    cnh_validation_status,
    rntrc_validation_status,
    validation_notes,
    background_check_status,
    validated_at,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN validated_by
        ELSE NULL::uuid
    END AS validated_by,
    CASE
        WHEN user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_affiliated_driver_of_my_company(id) THEN invoice_number
        ELSE NULL::text
    END AS invoice_number,
    address_city_id
FROM profiles
WHERE user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR is_freight_participant(id) OR is_service_participant(id) OR is_affiliated_driver_of_my_company(id);
