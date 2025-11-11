-- Criar buckets para anexos de chat interno
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat-interno-images', 'chat-interno-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('chat-interno-files', 'chat-interno-files', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'])
ON CONFLICT (id) DO NOTHING;

-- RLS Policies para chat-interno-images
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-interno-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view all images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-interno-images');

CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-interno-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-interno-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policies para chat-interno-files
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-interno-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view all files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-interno-files');

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-interno-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-interno-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);