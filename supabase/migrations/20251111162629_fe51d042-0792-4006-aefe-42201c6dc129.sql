-- Create storage buckets for proposal chat media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('proposal-chat-images', 'proposal-chat-images', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']),
  ('proposal-chat-files', 'proposal-chat-files', true, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for proposal-chat-images bucket
CREATE POLICY "Users can upload proposal chat images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposal-chat-images' AND
  (storage.foldername(name))[1] IN (
    SELECT proposal_id::text
    FROM proposal_chat_messages
    WHERE sender_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Anyone can view proposal chat images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'proposal-chat-images');

CREATE POLICY "Users can delete their own proposal chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'proposal-chat-images' AND
  (storage.foldername(name))[1] IN (
    SELECT proposal_id::text
    FROM proposal_chat_messages
    WHERE sender_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies for proposal-chat-files bucket
CREATE POLICY "Users can upload proposal chat files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposal-chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT proposal_id::text
    FROM proposal_chat_messages
    WHERE sender_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Anyone can view proposal chat files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'proposal-chat-files');

CREATE POLICY "Users can delete their own proposal chat files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'proposal-chat-files' AND
  (storage.foldername(name))[1] IN (
    SELECT proposal_id::text
    FROM proposal_chat_messages
    WHERE sender_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);