-- CORRECTED SECURITY FIX: Fix data exposure in RLS policies

-- 1. Fix ratings table - restrict access to involved parties only
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Users can view ratings involving them" ON public.ratings
FOR SELECT USING (
  rated_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  is_admin()
);

-- 2. Fix freights table - restrict OPEN freight visibility  
DROP POLICY IF EXISTS "Anyone can view open freights" ON public.freights;
CREATE POLICY "Users can view relevant freights" ON public.freights
FOR SELECT USING (
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  (status = 'OPEN' AND auth.uid() IS NOT NULL) OR -- Only authenticated users can see open freights
  is_admin()
);

-- 3. Fix guest_requests table - restrict to assigned providers and admins only
DROP POLICY IF EXISTS "Authenticated users can view guest requests" ON public.guest_requests;
CREATE POLICY "Only assigned providers and admins can view guest requests" ON public.guest_requests
FOR SELECT USING (
  provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  is_admin()
);

-- 4. Fix service_providers table - add more restrictive access (no changes to existing policies yet)
-- First check existing policies
-- Will be more restrictive in next migration if needed

-- 5. Ensure is_admin function is properly defined
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'ADMIN' 
    AND status = 'APPROVED'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 6. Add audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text,
  table_name text,
  record_id uuid DEFAULT NULL,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id,
    operation,
    table_name,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    event_type,
    table_name,
    details || jsonb_build_object('record_id', record_id),
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  );
EXCEPTION WHEN OTHERS THEN
  -- Log silently if audit fails
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;