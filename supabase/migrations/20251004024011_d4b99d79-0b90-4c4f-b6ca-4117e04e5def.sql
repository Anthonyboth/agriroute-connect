-- ============================================
-- PHASE 1: CREATE SECURE ROLE SYSTEM
-- ============================================

-- 1. Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'producer', 'service_provider');

-- 2. Create user_roles table with proper security
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
  user_id,
  CASE 
    WHEN role = 'ADMIN' THEN 'admin'::app_role
    WHEN role = 'MOTORISTA' THEN 'driver'::app_role
    WHEN role = 'PRODUTOR' THEN 'producer'::app_role
    WHEN role = 'PRESTADOR_SERVICOS' THEN 'service_provider'::app_role
  END as role,
  created_at
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Replace is_admin() function to use has_role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- 6. Create RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Add audit trigger for role changes
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, table_name, operation, new_data, timestamp)
    VALUES (auth.uid(), 'user_roles', 'ROLE_GRANTED', row_to_json(NEW), now());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, operation, old_data, timestamp)
    VALUES (auth.uid(), 'user_roles', 'ROLE_REVOKED', row_to_json(OLD), now());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_user_roles_changes
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- ============================================
-- PHASE 2: FIX PROFILES TABLE RLS
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles when authenticated" ON public.profiles;

-- Create restrictive policy - users can only see their own profile
CREATE POLICY "Users view own profile only"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any profile, users can update their own
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users update own profile, admins update any"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PHASE 3: FIX GUEST_REQUESTS TABLE RLS
-- ============================================

DROP POLICY IF EXISTS "Anyone can view guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Authenticated users can view guest requests" ON public.guest_requests;

CREATE POLICY "Only admins and assigned providers view guest requests"
ON public.guest_requests FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR provider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- ============================================
-- PHASE 4: FIX DRIVER_SERVICE_AREAS RLS
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view active service areas" ON public.driver_service_areas;

CREATE POLICY "Drivers view own areas, admins view all"
ON public.driver_service_areas FOR SELECT
TO authenticated
USING (
  driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Service role can access for matching operations
CREATE POLICY "Service role can access for matching"
ON public.driver_service_areas FOR SELECT
TO service_role
USING (is_active = true);

-- ============================================
-- PHASE 5: FIX SEARCH_PATH ON FUNCTIONS
-- ============================================

-- Update all SECURITY DEFINER functions to have fixed search_path
ALTER FUNCTION public.update_provider_service_area_polygon() SET search_path = public;
ALTER FUNCTION public.log_antt_usage() SET search_path = public;
ALTER FUNCTION public.check_mutual_ratings_complete(uuid) SET search_path = public;
ALTER FUNCTION public.create_additional_profile(uuid, user_role, text, text, text) SET search_path = public;
ALTER FUNCTION public.get_public_stats() SET search_path = public;
ALTER FUNCTION public.get_platform_stats() SET search_path = public;
ALTER FUNCTION public.update_tracking_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_accepted_trucks_count() SET search_path = public;
ALTER FUNCTION public.confirm_checkin_as_counterpart(uuid, text) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.log_sensitive_data_access(uuid, text) SET search_path = public;
ALTER FUNCTION public.send_notification(uuid, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.sync_freight_on_proposal_accept() SET search_path = public;
ALTER FUNCTION public.update_freight_status() SET search_path = public;
ALTER FUNCTION public.get_secure_request_details(uuid) SET search_path = public;
ALTER FUNCTION public.update_profile_rating() SET search_path = public;
ALTER FUNCTION public.update_loyalty_points() SET search_path = public;
ALTER FUNCTION public.get_compatible_freights_for_driver(uuid) SET search_path = public;
ALTER FUNCTION public.check_expired_documents() SET search_path = public;
ALTER FUNCTION public.check_low_ratings() SET search_path = public;
ALTER FUNCTION public.get_scheduled_freights_by_location_and_date(text, date, integer) SET search_path = public;
ALTER FUNCTION public.is_service_compatible(text[], text) SET search_path = public;
ALTER FUNCTION public.generate_admin_report(text, date, date) SET search_path = public;
ALTER FUNCTION public.find_providers_by_location(uuid, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.find_providers_by_service_and_location(uuid, numeric, numeric, text) SET search_path = public;
ALTER FUNCTION public.execute_service_matching(uuid, numeric, numeric, text) SET search_path = public;
ALTER FUNCTION public.can_notify_provider(uuid) SET search_path = public;
ALTER FUNCTION public.process_freight_withdrawal(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.notify_producer_delivery() SET search_path = public;
ALTER FUNCTION public.get_current_user_safe() SET search_path = public;
ALTER FUNCTION public.is_freight_owner(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.update_service_area_polygon() SET search_path = public;
ALTER FUNCTION public.find_drivers_by_origin(uuid) SET search_path = public;
ALTER FUNCTION public.find_drivers_by_route(uuid) SET search_path = public;
ALTER FUNCTION public.execute_freight_matching(uuid) SET search_path = public;
ALTER FUNCTION public.is_ip_blacklisted(inet) SET search_path = public;
ALTER FUNCTION public.encrypt_document(text) SET search_path = public;
ALTER FUNCTION public.decrypt_document(text, text) SET search_path = public;
ALTER FUNCTION public.can_notify_driver(uuid) SET search_path = public;
ALTER FUNCTION public.log_sensitive_data_access(text, uuid, text) SET search_path = public;
ALTER FUNCTION public.detect_suspicious_access(text, integer) SET search_path = public;
ALTER FUNCTION public.get_secure_user_profile() SET search_path = public;
ALTER FUNCTION public.audit_trigger_function() SET search_path = public;
ALTER FUNCTION public.check_rate_limit(text, integer, interval) SET search_path = public;
ALTER FUNCTION public.update_producer_service_area_geom() SET search_path = public;
ALTER FUNCTION public.auto_confirm_deliveries() SET search_path = public;