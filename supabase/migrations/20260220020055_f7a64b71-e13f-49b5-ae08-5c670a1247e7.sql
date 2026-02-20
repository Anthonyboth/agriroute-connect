
-- Fix 1: Drop the public SELECT policy on driver-documents (bucket already private)
DROP POLICY IF EXISTS "driver_documents_select_policy" ON storage.objects;

-- Fix 2: Make profile-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'profile-photos';

-- Fix 3: Drop the overly permissive "view all profile photos" policies
DROP POLICY IF EXISTS "Users can view all profile photos" ON storage.objects;

-- Ensure owner-scoped + admin SELECT policies exist for profile-photos (auth users only)
DROP POLICY IF EXISTS "Users can view their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all profile photos" ON storage.objects;

CREATE POLICY "profile_photos_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "profile_photos_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-photos' AND is_admin());
