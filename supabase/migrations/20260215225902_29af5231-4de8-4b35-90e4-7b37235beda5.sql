
-- =============================================
-- Make public storage buckets private
-- =============================================

UPDATE storage.buckets SET public = false WHERE id = 'chat-images';
UPDATE storage.buckets SET public = false WHERE id = 'proposal-chat-images';
UPDATE storage.buckets SET public = false WHERE id = 'proposal-chat-files';
UPDATE storage.buckets SET public = false WHERE id = 'service-chat-images';
UPDATE storage.buckets SET public = false WHERE id = 'mdfe-dactes';

-- =============================================
-- Drop overly permissive SELECT policies (public/anon)
-- =============================================

DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;
DROP POLICY IF EXISTS "Chat images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proposal chat images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proposal chat files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view service chat images" ON storage.objects;
DROP POLICY IF EXISTS "Service chat images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view mdfe dactes" ON storage.objects;
DROP POLICY IF EXISTS "MDF-e DACTEs are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "DACTE files are publicly accessible" ON storage.objects;

-- =============================================
-- Create authenticated-only SELECT policies (only if not exist)
-- =============================================

DO $$
BEGIN
  -- proposal-chat-images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view proposal chat images'
  ) THEN
    CREATE POLICY "Authenticated users can view proposal chat images"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'proposal-chat-images');
  END IF;

  -- proposal-chat-files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view proposal chat files'
  ) THEN
    CREATE POLICY "Authenticated users can view proposal chat files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'proposal-chat-files');
  END IF;

  -- service-chat-images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view service chat images'
  ) THEN
    CREATE POLICY "Authenticated users can view service chat images"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'service-chat-images');
  END IF;

  -- mdfe-dactes
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view mdfe dactes'
  ) THEN
    CREATE POLICY "Authenticated users can view mdfe dactes"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'mdfe-dactes');
  END IF;
END $$;
