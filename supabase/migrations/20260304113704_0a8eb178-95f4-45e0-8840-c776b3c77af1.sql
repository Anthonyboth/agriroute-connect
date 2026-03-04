-- Fix: Remove overly permissive legacy policies on profiles_encrypted_data
-- The strict owner-only policies (pii_*_own_strict) already handle all operations correctly.

-- 1. Drop pii_delete_cascade: uses PUBLIC role, allows delete if profile missing OR service_role
DROP POLICY IF EXISTS "pii_delete_cascade" ON public.profiles_encrypted_data;

-- 2. Drop pii_insert_trigger_only: uses PUBLIC role, only checks profile exists (not ownership)
DROP POLICY IF EXISTS "pii_insert_trigger_only" ON public.profiles_encrypted_data;

-- Remaining policies (all properly scoped):
-- anon_no_access_pii: ALL denied for anon
-- pii_select_own_strict: SELECT where id = get_my_profile_id_for_pii()
-- pii_insert_own_strict: INSERT where id = get_my_profile_id_for_pii()
-- pii_update_own_strict: UPDATE where id = get_my_profile_id_for_pii()
-- pii_delete_own_strict: DELETE where id = get_my_profile_id_for_pii()