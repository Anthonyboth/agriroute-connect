-- Complete remaining policies (buckets already made private)
-- Drop if exists first to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view chat images" ON storage.objects;

-- Add proper RLS for chat-images (only if not exists)
CREATE POLICY "Authenticated users can view chat images"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('chat-images', 'chat-interno-images')
  AND auth.uid() IS NOT NULL
);