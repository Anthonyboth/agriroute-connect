-- Garantir que o bucket driver-documents existe e está configurado corretamente
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents', 
  'driver-documents', 
  true, 
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- RLS Policies para o bucket driver-documents
-- Política de INSERT: usuários autenticados podem fazer upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'driver_documents_insert_policy'
  ) THEN
    CREATE POLICY "driver_documents_insert_policy"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'driver-documents');
  END IF;
END $$;

-- Política de SELECT: leitura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'driver_documents_select_policy'
  ) THEN
    CREATE POLICY "driver_documents_select_policy"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'driver-documents');
  END IF;
END $$;

-- Política de UPDATE: usuários autenticados podem atualizar seus uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'driver_documents_update_policy'
  ) THEN
    CREATE POLICY "driver_documents_update_policy"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'driver-documents');
  END IF;
END $$;

-- Política de DELETE: usuários autenticados podem deletar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'driver_documents_delete_policy'
  ) THEN
    CREATE POLICY "driver_documents_delete_policy"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'driver-documents');
  END IF;
END $$;