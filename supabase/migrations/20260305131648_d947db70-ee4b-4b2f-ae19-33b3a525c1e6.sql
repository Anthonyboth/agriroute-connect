
-- Drop existing view and recreate with contact masking
DROP VIEW IF EXISTS public.service_requests_secure;

CREATE VIEW public.service_requests_secure
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  sr.id,
  sr.service_type,
  sr.status,
  sr.created_at,
  sr.updated_at,
  sr.preferred_datetime,
  sr.location_city,
  sr.location_state,
  sr.location_lat,
  sr.location_lng,
  sr.problem_description,
  sr.additional_info,
  sr.urgency,
  sr.is_emergency,
  sr.vehicle_info,
  sr.estimated_price,
  sr.final_price,
  sr.accepted_at,
  sr.completed_at,
  sr.cancelled_at,
  sr.cancellation_reason,
  sr.client_id,
  sr.provider_id,
  -- Mask address for non-participants
  CASE
    WHEN sr.client_id = get_my_profile_id()
      OR sr.provider_id = get_my_profile_id()
      OR is_admin()
    THEN sr.location_address
    ELSE NULL
  END AS location_address,
  sr.reference_number,
  sr.city_name,
  sr.state,
  sr.city_lat,
  sr.city_lng,
  sr.city_id,
  sr.service_radius_km,
  sr.provider_notes,
  sr.client_rating,
  sr.provider_rating,
  sr.client_comment,
  sr.provider_comment,
  -- Contact info: only visible to participants and admins
  CASE
    WHEN sr.client_id = get_my_profile_id()
      OR sr.provider_id = get_my_profile_id()
      OR is_admin()
    THEN sr.contact_phone
    ELSE NULL
  END AS contact_phone,
  CASE
    WHEN sr.client_id = get_my_profile_id()
      OR sr.provider_id = get_my_profile_id()
      OR is_admin()
    THEN sr.contact_email
    ELSE NULL
  END AS contact_email,
  CASE
    WHEN sr.client_id = get_my_profile_id()
      OR sr.provider_id = get_my_profile_id()
      OR is_admin()
    THEN sr.contact_name
    ELSE '***'
  END AS contact_name,
  CASE
    WHEN sr.client_id = get_my_profile_id()
      OR sr.provider_id = get_my_profile_id()
      OR is_admin()
    THEN sr.contact_document
    ELSE NULL
  END AS contact_document,
  sr.on_the_way_at,
  sr.in_progress_at,
  sr.destination_address,
  sr.destination_city,
  sr.destination_state,
  sr.destination_lat,
  sr.destination_lng,
  sr.expires_at,
  sr.prospect_user_id
FROM public.service_requests sr;

-- Permissions
REVOKE SELECT ON public.service_requests FROM anon;
GRANT SELECT ON public.service_requests_secure TO authenticated;

-- Deny anon on base table
DROP POLICY IF EXISTS "service_requests_deny_anon_all" ON public.service_requests;
CREATE POLICY "service_requests_deny_anon_all"
  ON public.service_requests
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
