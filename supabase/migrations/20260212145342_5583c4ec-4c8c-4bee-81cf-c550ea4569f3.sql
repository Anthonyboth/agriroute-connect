
-- ============================================================
-- FIX 1: profiles_select_service_participants TO public → TO authenticated
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_service_participants" ON public.profiles;

CREATE POLICY "profiles_select_service_participants"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_service_participant(id));

-- ============================================================
-- FIX 2: Revoke direct SELECT on PII columns for anon and authenticated
-- ============================================================
REVOKE SELECT (
  cpf_cnpj, phone, contact_phone, document,
  emergency_contact_name, emergency_contact_phone,
  address_street, address_number, address_complement,
  address_neighborhood, address_zip, farm_address,
  email, document_photo_url, cnh_photo_url,
  truck_documents_url, license_plate_photo_url,
  address_proof_url, document_rg_url, document_cpf_url,
  cnh_url, rntrc, antt_number, invoice_number
) ON public.profiles FROM anon, authenticated;

-- Grant SELECT on non-sensitive columns
GRANT SELECT (
  id, user_id, full_name, status, created_at, updated_at,
  selfie_url, profile_photo_url, location_enabled,
  rating, total_ratings, rating_sum, rating_locked,
  farm_name, farm_lat, farm_lng, cooperative,
  cnh_expiry_date, cnh_category,
  document_validation_status, cnh_validation_status, rntrc_validation_status,
  validation_notes, validation_status, validated_at, validated_by,
  background_check_status,
  last_gps_update, current_location_lat, current_location_lng,
  service_types, aprovado,
  vehicle_other_type, vehicle_specifications,
  live_cargo_experience, fixed_address,
  service_regions, service_radius_km, service_cities, service_states,
  base_city_name, base_state, base_lat, base_lng,
  current_city_name, current_state,
  address_city, address_state, address_city_id,
  base_city_id, active_mode, metadata, role
) ON public.profiles TO anon, authenticated;

-- ============================================================
-- FIX 3: Recreate profiles_secure view with PII masking
-- ============================================================
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.user_id,
  p.full_name,
  p.status,
  p.rating,
  p.total_ratings,
  p.created_at,
  p.updated_at,
  -- PII: only visible to owner and admins
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.cpf_cnpj ELSE '***' END AS cpf_cnpj,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.phone ELSE NULL END AS phone,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.contact_phone ELSE NULL END AS contact_phone,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_street ELSE NULL END AS address_street,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_city ELSE NULL END AS address_city,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_state ELSE NULL END AS address_state,
  p.profile_photo_url,
  p.service_types,
  p.base_city_name,
  p.base_state,
  p.aprovado,
  p.validation_status,
  -- Additional useful fields
  p.selfie_url,
  p.current_city_name,
  p.current_state,
  p.active_mode,
  p.role,
  p.cooperative,
  p.farm_name,
  p.rating_sum,
  p.rating_locked,
  p.service_regions,
  p.service_radius_km,
  p.service_cities,
  p.service_states,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.email ELSE NULL END AS email,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.rntrc ELSE NULL END AS rntrc,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.document ELSE NULL END AS document,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.emergency_contact_name ELSE NULL END AS emergency_contact_name,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.emergency_contact_phone ELSE NULL END AS emergency_contact_phone,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.farm_address ELSE NULL END AS farm_address,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_number ELSE NULL END AS address_number,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_complement ELSE NULL END AS address_complement,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_neighborhood ELSE NULL END AS address_neighborhood,
  CASE WHEN p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
    THEN p.address_zip ELSE NULL END AS address_zip
FROM public.profiles p;

GRANT SELECT ON public.profiles_secure TO anon, authenticated;
