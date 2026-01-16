-- Criar bucket privado para certificados fiscais A1
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fiscal-certificates', 
  'fiscal-certificates', 
  false,  -- Bucket PRIVADO (certificados são sensíveis)
  10485760,  -- 10MB limit
  ARRAY['application/x-pkcs12', 'application/octet-stream']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Service role pode fazer tudo (edge functions usam service role)
-- Usuários não devem acessar diretamente os certificados

-- Policy para upload via service role (edge function)
CREATE POLICY "Service role can manage certificates"
ON storage.objects
FOR ALL
USING (bucket_id = 'fiscal-certificates')
WITH CHECK (bucket_id = 'fiscal-certificates');