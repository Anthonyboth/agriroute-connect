-- Fix: Remove overly permissive guest_requests_select_auth policy
-- This policy allows ANY authenticated user to SELECT all guest requests,
-- exposing contact information (phone, name) to unauthorized users.
-- The remaining policies properly restrict access to admins and assigned providers.

DROP POLICY IF EXISTS "guest_requests_select_auth" ON public.guest_requests;

-- Also clean up redundant overlapping SELECT policies on guest_requests
-- Keep only the well-scoped ones for authenticated role
-- These 3 use "public" role which includes anon — restrict to authenticated only

DROP POLICY IF EXISTS "Admins or assigned provider can read guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Only admins can view guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "Only assigned providers and admins can view guest requests" ON public.guest_requests;
DROP POLICY IF EXISTS "guest_requests_admin_select" ON public.guest_requests;

-- Also fix INSERT: guest_requests_insert_auth uses public role, should use anon for guests
-- and guest_requests_validated_insert also uses public
-- Keep validated_insert (has field checks) and insert_auth (auth check)
-- But restrict insert_auth to prevent anon from inserting without validation
DROP POLICY IF EXISTS "guest_requests_insert_auth" ON public.guest_requests;

-- Recreate a clean INSERT policy for anon (guests) with validation
CREATE POLICY "guest_requests_anon_insert_validated"
ON public.guest_requests
FOR INSERT
TO anon
WITH CHECK (
  contact_phone IS NOT NULL 
  AND contact_phone <> '' 
  AND length(contact_phone) <= 20
  AND request_type IS NOT NULL 
  AND payload IS NOT NULL
  AND (contact_name IS NULL OR length(contact_name) <= 200)
);

-- Recreate clean INSERT for authenticated users
CREATE POLICY "guest_requests_auth_insert"
ON public.guest_requests
FOR INSERT
TO authenticated
WITH CHECK (
  contact_phone IS NOT NULL 
  AND contact_phone <> '' 
  AND length(contact_phone) <= 20
  AND request_type IS NOT NULL 
  AND payload IS NOT NULL
);

-- Add explicit deny for anon SELECT (belt and suspenders)
DROP POLICY IF EXISTS "guest_requests_deny_anon_select" ON public.guest_requests;
CREATE POLICY "guest_requests_deny_anon_select"
ON public.guest_requests
FOR SELECT
TO anon
USING (false);

-- The remaining policy "Only admins and assigned providers view guest requests" (authenticated)
-- already properly restricts SELECT. Keep it.