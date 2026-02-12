
-- Revoke SELECT on PII columns from service_requests for anon and authenticated
-- Forces usage of service_requests_secure view for contact data
REVOKE SELECT (contact_phone) ON public.service_requests FROM anon, authenticated;
REVOKE SELECT (contact_email) ON public.service_requests FROM anon, authenticated;
REVOKE SELECT (contact_name) ON public.service_requests FROM anon, authenticated;
REVOKE SELECT (contact_document) ON public.service_requests FROM anon, authenticated;

-- Grant SELECT on all non-PII columns explicitly
GRANT SELECT (
  id, service_type, status, created_at, updated_at,
  preferred_datetime, location_city, location_state,
  location_lat, location_lng, problem_description,
  additional_info, urgency, is_emergency, vehicle_info,
  estimated_price, final_price, accepted_at, completed_at,
  cancelled_at, cancellation_reason, client_id, provider_id,
  location_address, reference_number, city_name, state,
  city_lat, city_lng, city_id, service_radius_km,
  provider_notes, client_rating, provider_rating,
  client_comment, provider_comment,
  on_the_way_at, in_progress_at
) ON public.service_requests TO anon, authenticated;
