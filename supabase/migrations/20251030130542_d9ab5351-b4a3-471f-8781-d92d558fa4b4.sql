-- Create fast profile RPC to bypass RLS overhead
-- This function uses SECURITY DEFINER to avoid RLS checks while remaining safe
-- by only returning the profile for auth.uid()
CREATE OR REPLACE FUNCTION public.get_profile_me()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  phone text,
  document text,
  email text,
  role text,
  status text,
  active_mode text,
  service_types text[],
  base_city_name text,
  base_state text,
  base_city_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  cpf_cnpj text,
  rntrc text,
  antt_number text,
  cooperative text,
  rating numeric,
  cnh_expiry_date date,
  cnh_category text,
  document_validation_status text,
  cnh_validation_status text,
  rntrc_validation_status text,
  validation_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  background_check_status text,
  rating_locked boolean,
  last_gps_update timestamptz,
  current_location_lat numeric,
  current_location_lng numeric,
  base_lat numeric,
  base_lng numeric,
  current_city_name text,
  current_state text,
  selfie_url text,
  document_photo_url text,
  cnh_photo_url text,
  truck_documents_url text,
  truck_photo_url text,
  license_plate_photo_url text,
  address_proof_url text,
  contact_phone text,
  location_enabled boolean,
  farm_name text,
  farm_address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Return only the profile(s) for the authenticated user
  -- SECURITY: auth.uid() ensures we only return data for the current user
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.full_name,
    p.phone,
    p.document,
    p.email,
    p.role,
    p.status,
    p.active_mode,
    p.service_types,
    p.base_city_name,
    p.base_state,
    p.base_city_id,
    p.created_at,
    p.updated_at,
    p.cpf_cnpj,
    p.rntrc,
    p.antt_number,
    p.cooperative,
    p.rating,
    p.cnh_expiry_date,
    p.cnh_category,
    p.document_validation_status,
    p.cnh_validation_status,
    p.rntrc_validation_status,
    p.validation_notes,
    p.emergency_contact_name,
    p.emergency_contact_phone,
    p.background_check_status,
    p.rating_locked,
    p.last_gps_update,
    p.current_location_lat,
    p.current_location_lng,
    p.base_lat,
    p.base_lng,
    p.current_city_name,
    p.current_state,
    p.selfie_url,
    p.document_photo_url,
    p.cnh_photo_url,
    p.truck_documents_url,
    p.truck_photo_url,
    p.license_plate_photo_url,
    p.address_proof_url,
    p.contact_phone,
    p.location_enabled,
    p.farm_name,
    p.farm_address
  FROM profiles p
  WHERE p.user_id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile_me() TO authenticated;

-- Add comment explaining the function's purpose
COMMENT ON FUNCTION public.get_profile_me() IS 
'Fast profile fetch for authenticated user using SECURITY DEFINER to bypass RLS. Only returns profiles for auth.uid() - safe by design.';
