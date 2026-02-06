
-- =============================================
-- FIX 1: Make mdfe-dactes bucket private
-- =============================================
UPDATE storage.buckets SET public = false WHERE id = 'mdfe-dactes';

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view DACTEs" ON storage.objects;

-- Create restrictive policy: only freight participants, emitter, company owner, or admin
CREATE POLICY "mdfe_dactes_authenticated_participants"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mdfe-dactes' AND (
    -- Emitter of the manifesto
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      WHERE m.id::text = (storage.foldername(name))[1]
      AND m.emitted_by_id = get_my_profile_id()
    )
    OR
    -- Producer or driver of the freight
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      JOIN freights f ON f.id = m.freight_id
      WHERE m.id::text = (storage.foldername(name))[1]
      AND (f.producer_id = get_my_profile_id() OR f.driver_id = get_my_profile_id())
    )
    OR
    -- Company owner
    EXISTS (
      SELECT 1 FROM mdfe_manifestos m
      JOIN transport_companies tc ON tc.id = m.company_id
      WHERE m.id::text = (storage.foldername(name))[1]
      AND tc.profile_id = get_my_profile_id()
    )
    OR
    -- Admin
    is_admin()
  )
);

-- =============================================
-- FIX 2: Restrict fiscal_issuers "Transportadoras view all"
-- Replace with policy that only allows viewing OWN company issuers
-- =============================================
DROP POLICY IF EXISTS "Transportadoras view all" ON fiscal_issuers;

-- Transportadoras can only view their own issuers (linked to their profile)
CREATE POLICY "Transportadoras view own issuers"
ON fiscal_issuers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = fiscal_issuers.profile_id
    AND p.user_id = auth.uid()
  )
  OR is_admin()
);
