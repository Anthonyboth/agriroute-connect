
-- Make service-chat-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'service-chat-images';

-- Only create policies that don't exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload service chat images' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload service chat images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'service-chat-images');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own service chat images' AND tablename = 'objects') THEN
    CREATE POLICY "Users can delete their own service chat images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'service-chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
