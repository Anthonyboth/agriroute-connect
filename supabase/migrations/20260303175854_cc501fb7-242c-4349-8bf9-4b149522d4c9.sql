
-- Auto-expire announcements past their ends_at date
CREATE OR REPLACE FUNCTION public.auto_expire_announcements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE system_announcements
  SET is_active = false
  WHERE is_active = true
    AND ends_at IS NOT NULL
    AND ends_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- Revoke public access, grant to service_role only
REVOKE EXECUTE ON FUNCTION public.auto_expire_announcements() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_expire_announcements() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_expire_announcements() FROM authenticated;
