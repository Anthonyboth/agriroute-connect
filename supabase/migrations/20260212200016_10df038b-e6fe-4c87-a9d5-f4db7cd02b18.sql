
-- =====================================================
-- FIX: REVOKE table-level SELECT e re-GRANT apenas colunas seguras
-- PostgreSQL: column REVOKE não sobrepõe table GRANT
-- =====================================================

-- 1. Revogar SELECT da tabela inteira
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- 2. Re-GRANT SELECT apenas nas colunas NÃO-sensíveis
GRANT SELECT (
  id, user_id, full_name, status, rating, total_ratings, rating_sum, rating_locked,
  created_at, updated_at, profile_photo_url, service_types, base_city_name, base_state,
  aprovado, validation_status, current_city_name, current_state, active_mode, role,
  cooperative, farm_name, service_regions, service_radius_km, service_cities, service_states,
  location_enabled, vehicle_other_type, vehicle_specifications, live_cargo_experience,
  base_lat, base_lng, base_city_id, metadata, document_validation_status,
  cnh_validation_status, rntrc_validation_status, validation_notes, background_check_status,
  validated_at, validated_by, invoice_number, address_city_id, farm_lat, farm_lng,
  last_gps_update, current_location_lat, current_location_lng
) ON public.profiles TO authenticated;

-- 3. Anon: apenas campos mínimos (para views públicas se necessário)  
GRANT SELECT (id, full_name, role, status, rating, profile_photo_url, base_city_name, base_state) ON public.profiles TO anon;
