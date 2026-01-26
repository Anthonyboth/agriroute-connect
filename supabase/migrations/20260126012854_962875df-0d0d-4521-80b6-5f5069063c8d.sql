-- Add missing columns to service_requests_secure view
DROP VIEW IF EXISTS public.service_requests_secure;
CREATE VIEW public.service_requests_secure
WITH (security_invoker = true) AS
SELECT
  id, service_type, status, created_at, updated_at, preferred_datetime,
  location_city, location_state, location_lat, location_lng,
  problem_description, additional_info, urgency, is_emergency, vehicle_info,
  estimated_price, final_price, accepted_at, completed_at, cancelled_at,
  cancellation_reason, client_id, provider_id, location_address, reference_number,
  city_name, state, city_lat, city_lng, city_id, service_radius_km,
  provider_notes, client_rating, provider_rating, client_comment, provider_comment,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_phone ELSE '***-****'
  END as contact_phone,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_email ELSE '***@***.***'
  END as contact_email,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_name ELSE CONCAT(LEFT(contact_name, 3), '***')
  END as contact_name,
  CASE 
    WHEN client_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    THEN contact_document ELSE NULL
  END as contact_document
FROM public.service_requests;

GRANT SELECT ON public.service_requests_secure TO authenticated;