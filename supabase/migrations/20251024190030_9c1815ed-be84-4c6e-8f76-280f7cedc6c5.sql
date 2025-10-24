-- Create RPC function to cancel accepted services and return them to marketplace
CREATE OR REPLACE FUNCTION public.cancel_accepted_service(
  p_provider_id uuid,
  p_request_id uuid,
  p_cancellation_reason text DEFAULT 'PROVIDER_CANCELLATION'
)
RETURNS TABLE (
  id uuid,
  status text,
  provider_id uuid,
  cancellation_reason text,
  cancelled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_current_provider_id uuid;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Get current status and provider_id
  SELECT sr.status, sr.provider_id 
  INTO v_current_status, v_current_provider_id
  FROM service_requests sr
  WHERE sr.id = p_request_id;

  -- Check if service request exists
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Serviço não encontrado';
  END IF;

  -- Check if provider is the owner
  IF v_current_provider_id != p_provider_id THEN
    RAISE EXCEPTION 'Você não é o prestador deste serviço';
  END IF;

  -- Check if service can be cancelled (not completed)
  IF v_current_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Não é possível cancelar um serviço já concluído ou cancelado';
  END IF;

  -- Update service request to OPEN status and remove provider assignment
  RETURN QUERY
  UPDATE service_requests
  SET 
    status = 'OPEN',
    provider_id = NULL,
    accepted_at = NULL,
    cancellation_reason = p_cancellation_reason,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_request_id
  RETURNING 
    service_requests.id,
    service_requests.status,
    service_requests.provider_id,
    service_requests.cancellation_reason,
    service_requests.cancelled_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_accepted_service TO authenticated;

COMMENT ON FUNCTION public.cancel_accepted_service IS 'Allows service providers to cancel accepted services and return them to marketplace';