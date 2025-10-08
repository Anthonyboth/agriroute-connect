-- Criar bucket de storage para imagens do chat de serviços
INSERT INTO storage.buckets (id, name, public) 
VALUES ('service-chat-images', 'service-chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Users can upload images to service chat"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'service-chat-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view service chat images"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-chat-images');

CREATE POLICY "Users can update their own service chat images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'service-chat-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own service chat images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'service-chat-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);