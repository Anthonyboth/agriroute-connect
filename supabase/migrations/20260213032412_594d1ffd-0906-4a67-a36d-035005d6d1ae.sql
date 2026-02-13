
-- Fix: Grant missing columns that the app needs to function
GRANT SELECT (
  selfie_url,
  validation_notes,
  last_gps_update,
  current_location_lat,
  current_location_lng,
  phone,
  cnh_expiry_date,
  cnh_category
) ON public.profiles TO authenticated;
