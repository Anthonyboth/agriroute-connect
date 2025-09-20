-- Recreate get_provider_service_requests without referencing non-existent columns
DROP FUNCTION IF EXISTS public.get_provider_service_requests(uuid);

CREATE OR REPLACE FUNCTION public.get_provider_service_requests(provider_profile_id uuid)
RETURNS TABLE (
  additional_info text,
  client_id uuid,
  contact_name text,
  contact_phone text,
  contact_phone_safe text,
  created_at timestamptz,
  distance_km numeric,
  estimated_price numeric,
  id uuid,
  is_emergency boolean,
  location_address text,
  location_address_safe text,
  preferred_datetime timestamptz,
  problem_description text,
  request_source text,
  service_type text,
  status text,
  urgency text,
  vehicle_info text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guest requests (public or assigned)
  RETURN QUERY
  SELECT
    COALESCE((gr.payload->>'additional_info')::text, NULL)::text AS additional_info,
    NULL::uuid AS client_id,
    gr.contact_name::text,
    gr.contact_phone::text,
    '***-****-****'::text AS contact_phone_safe,
    gr.created_at::timestamptz,
    NULLIF(gr.payload->>'distance_km', '')::numeric AS distance_km,
    NULLIF(gr.payload->>'estimated_price', '')::numeric AS estimated_price,
    gr.id::uuid,
    COALESCE((gr.payload->>'is_emergency')::boolean, false) AS is_emergency,
    COALESCE(gr.payload->>'location_address', NULL)::text AS location_address,
    'Endereço restrito'::text AS location_address_safe,
    NULLIF(gr.payload->>'preferred_datetime', '')::timestamptz AS preferred_datetime,
    COALESCE(gr.payload->>'problem_description', NULL)::text AS problem_description,
    'guest_requests'::text AS request_source,
    COALESCE(gr.service_type, gr.request_type)::text AS service_type,
    gr.status::text,
    COALESCE(gr.payload->>'urgency', NULL)::text AS urgency,
    COALESCE(gr.payload->>'vehicle_info', NULL)::text AS vehicle_info
  FROM public.guest_requests gr
  WHERE gr.provider_id IS NULL OR gr.provider_id = provider_profile_id

  UNION ALL

  -- Service requests assigned to provider (use only guaranteed columns)
  SELECT
    NULL::text AS additional_info,
    sr.client_id::uuid,
    p.full_name::text AS contact_name,
    p.phone::text AS contact_phone,
    '***-****-****'::text AS contact_phone_safe,
    sr.created_at::timestamptz,
    NULL::numeric AS distance_km,
    sr.final_price::numeric AS estimated_price,
    sr.id::uuid,
    false AS is_emergency,
    NULL::text AS location_address,
    'Endereço restrito'::text AS location_address_safe,
    NULL::timestamptz AS preferred_datetime,
    NULL::text AS problem_description,
    'service_requests'::text AS request_source,
    'SERVICO'::text AS service_type,
    sr.status::text,
    NULL::text AS urgency,
    NULL::text AS vehicle_info
  FROM public.service_requests sr
  LEFT JOIN public.profiles p ON p.id = sr.client_id
  WHERE sr.provider_id = provider_profile_id

  ORDER BY created_at DESC;

  IF NOT FOUND THEN
    RETURN;
  END IF;
END;
$$;