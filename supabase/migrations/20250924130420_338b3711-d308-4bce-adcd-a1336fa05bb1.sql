-- Create secure function to accept service requests bypassing RLS visibility issues
CREATE OR REPLACE FUNCTION public.accept_service_request(
  p_provider_id uuid,
  p_request_id uuid
)
RETURNS TABLE (
  id uuid,
  status text,
  provider_id uuid,
  accepted_at timestamptz
) AS $$
DECLARE
  is_provider boolean;
BEGIN
  -- Ensure the caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify provider exists
  SELECT EXISTS(
    SELECT 1 FROM public.service_providers sp 
    WHERE sp.profile_id = p_provider_id
  ) INTO is_provider;

  IF NOT is_provider THEN
    RAISE EXCEPTION 'provider not registered';
  END IF;

  -- Perform acceptance only if request is still open/pending and unassigned
  RETURN QUERY
  UPDATE public.service_requests sr
  SET 
    provider_id = p_provider_id,
    status = 'ACCEPTED',
    accepted_at = now(),
    updated_at = now()
  WHERE sr.id = p_request_id
    AND sr.provider_id IS NULL
    AND sr.status IN ('OPEN','PENDING')
  RETURNING sr.id, sr.status, sr.provider_id, sr.accepted_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Allow authenticated users to execute the function
GRANT EXECUTE ON FUNCTION public.accept_service_request(uuid, uuid) TO authenticated;