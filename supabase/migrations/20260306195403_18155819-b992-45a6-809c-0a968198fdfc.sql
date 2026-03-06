
-- Secure view that masks location for completed freights (defense in depth)
CREATE OR REPLACE VIEW public.freight_messages_secure AS
SELECT
  fm.id,
  fm.freight_id,
  fm.sender_id,
  fm.message,
  fm.image_url,
  fm.message_type,
  fm.created_at,
  fm.read_at,
  CASE WHEN f.status IN ('IN_TRANSIT', 'LOADING', 'LOADED', 'ACCEPTED', 'OPEN', 'IN_NEGOTIATION')
       THEN fm.location_lat ELSE NULL END AS location_lat,
  CASE WHEN f.status IN ('IN_TRANSIT', 'LOADING', 'LOADED', 'ACCEPTED', 'OPEN', 'IN_NEGOTIATION')
       THEN fm.location_lng ELSE NULL END AS location_lng,
  CASE WHEN f.status IN ('IN_TRANSIT', 'LOADING', 'LOADED', 'ACCEPTED', 'OPEN', 'IN_NEGOTIATION')
       THEN fm.location_address ELSE NULL END AS location_address,
  fm.target_vehicle_id,
  fm.target_driver_id,
  fm.is_location_request,
  fm.request_responded_at,
  fm.chat_closed_by,
  fm.file_url,
  fm.file_name,
  fm.file_size
FROM public.freight_messages fm
JOIN public.freights f ON f.id = fm.freight_id;

REVOKE ALL ON public.freight_messages_secure FROM anon;
GRANT SELECT ON public.freight_messages_secure TO authenticated;

-- Clean up existing location data on already-completed freights
UPDATE public.freight_messages fm
SET location_lat = NULL,
    location_lng = NULL,
    location_address = NULL
FROM public.freights f
WHERE f.id = fm.freight_id
  AND f.status IN ('DELIVERED', 'COMPLETED', 'CANCELLED', 'DELIVERED_PENDING_CONFIRMATION')
  AND (fm.location_lat IS NOT NULL OR fm.location_lng IS NOT NULL OR fm.location_address IS NOT NULL);
