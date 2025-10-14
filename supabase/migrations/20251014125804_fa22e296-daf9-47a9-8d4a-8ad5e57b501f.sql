-- Criar bucket para documentos de transportadoras
INSERT INTO storage.buckets (id, name, public)
VALUES ('transport-documents', 'transport-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies para o bucket
CREATE POLICY "Users can upload their own transport documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transport-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own transport documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'transport-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins podem ver todos os documentos
CREATE POLICY "Admins can view all transport documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'transport-documents' AND
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role)
);