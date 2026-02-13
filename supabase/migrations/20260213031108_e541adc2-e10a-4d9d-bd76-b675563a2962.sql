
-- =============================================
-- FIX: profiles table column-level security
-- Revoke table-level SELECT and grant only safe columns
-- =============================================

-- 1. Revoke TABLE-level SELECT from authenticated and anon
--    This ensures column-level ACL is the ONLY path to read data
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- 2. Revoke SELECT on ALL columns first (clean slate for column grants)
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- 3. Grant SELECT only on NON-SENSITIVE columns for authenticated
GRANT SELECT (
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
  role,
  base_city_name,
  base_state,
  current_city_name,
  current_state,
  service_types,
  service_regions,
  service_radius_km,
  service_cities,
  service_states,
  aprovado,
  cooperative,
  farm_name,
  vehicle_other_type,
  vehicle_specifications,
  live_cargo_experience,
  active_mode,
  cnh_expiry_date,
  cnh_category,
  document_validation_status,
  cnh_validation_status,
  rntrc_validation_status,
  background_check_status,
  validation_status,
  validated_at,
  location_enabled,
  base_lat,
  base_lng,
  base_city_id,
  metadata
) ON public.profiles TO authenticated;

-- 4. Grant SELECT only on minimal public columns for anon
GRANT SELECT (
  id,
  full_name,
  status,
  rating,
  profile_photo_url,
  role,
  base_city_name,
  base_state
) ON public.profiles TO anon;

-- 5. Ensure INSERT and UPDATE still work for authenticated
-- (These are already controlled by RLS policies)
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
