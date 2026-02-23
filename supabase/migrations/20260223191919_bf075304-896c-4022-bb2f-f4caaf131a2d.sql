-- Fix: Make profile-photos bucket private to prevent unauthenticated access
-- The application already uses signed URLs everywhere, so this is safe
UPDATE storage.buckets 
SET public = false 
WHERE id = 'profile-photos';