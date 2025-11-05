-- Fix 1: Enable RLS on user_devices table (has policies but RLS disabled)
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- Fix 2: Drop public chat storage policies and create secure ones
DROP POLICY IF EXISTS "Arquivos de chat são públicos" ON storage.objects;
DROP POLICY IF EXISTS "Imagens de chat são públicas" ON storage.objects;

-- Create authenticated-only policies for chat files
CREATE POLICY "Authenticated users can view chat files"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('chat-files', 'chat-images')
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can upload their own chat files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-files'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own chat images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);