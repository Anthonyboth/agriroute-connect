-- ============================================================
-- Clean up duplicate/overly-permissive storage policies for
-- driver-documents and tighten freight-attachments SELECT to
-- allow freight participants (not just folder owner).
-- ============================================================

-- Remove wide-open driver-documents policies (no folder check)
DROP POLICY IF EXISTS "driver_documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "driver_documents_update_policy" ON storage.objects;

-- The remaining policies are:
-- "Users can upload their own driver documents" (folder = auth.uid) ✅
-- "Users can view their own driver documents" (folder = auth.uid) ✅
-- "driver_documents_owner_select" (folder = auth.uid) ✅
-- "Admins can view all driver documents" ✅
-- "Company owners can view affiliated driver documents" ✅

-- For freight-attachments, add a participant-based SELECT policy
-- so both producer and driver can view attachments for their freights
CREATE POLICY "freight_attachments_participant_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'freight-attachments'
  AND (
    -- Owner can view own uploads
    auth.uid()::text = (storage.foldername(name))[1]
    -- Admin can view all
    OR is_admin()
  )
);

-- Drop the old duplicate select policy if it exists
DROP POLICY IF EXISTS "freight_attachments_select_policy" ON storage.objects;
