-- Fix: Tighten is_service_participant to only allow access during active services
-- Previously it allowed access for ALL non-cancelled services (including COMPLETED)
-- Now it matches the same restrictive scope as is_freight_participant

CREATE OR REPLACE FUNCTION public.is_service_participant(target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE (
      (sr.client_id = target_profile_id AND sr.provider_id = get_my_profile_id())
      OR
      (sr.provider_id = target_profile_id AND sr.client_id = get_my_profile_id())
    )
    AND sr.status IN ('ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
    AND sr.accepted_at IS NOT NULL
    AND sr.completed_at IS NULL
    AND sr.cancelled_at IS NULL
  );
$$;
