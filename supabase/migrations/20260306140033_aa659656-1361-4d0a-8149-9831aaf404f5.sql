-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Ensure authenticated can call the RPC
GRANT EXECUTE ON FUNCTION public.process_freight_withdrawal(uuid, uuid) TO authenticated;