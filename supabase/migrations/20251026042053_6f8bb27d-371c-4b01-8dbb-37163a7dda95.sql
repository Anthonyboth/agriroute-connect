-- FASE 1: Adicionar colunas para funcionalidades avançadas de chat

-- Modificar company_driver_chats para suportar mídia e interações
ALTER TABLE company_driver_chats 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES company_driver_chats(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_company_chats_reply_to ON company_driver_chats(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_chats_deleted ON company_driver_chats(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_chats_read ON company_driver_chats(read_at);

-- Tabela para indicadores de digitação (typing indicators)
CREATE TABLE IF NOT EXISTS chat_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  driver_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_typing BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, driver_profile_id, user_profile_id)
);

-- RLS para typing indicators
ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participantes podem gerenciar typing indicators"
  ON chat_typing_indicators FOR ALL
  USING (
    (user_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR
    (EXISTS (
      SELECT 1 FROM transport_companies tc
      WHERE tc.id = chat_typing_indicators.company_id
      AND tc.profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    ))
    OR
    (driver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
  WITH CHECK (
    (user_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  );

-- Buckets para storage de arquivos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat-images', 'chat-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('chat-files', 'chat-files', true, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para chat-images
CREATE POLICY "Usuários autenticados podem fazer upload de imagens"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Imagens de chat são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-images');

CREATE POLICY "Usuários podem deletar suas próprias imagens"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Políticas de storage para chat-files
CREATE POLICY "Usuários autenticados podem fazer upload de arquivos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Arquivos de chat são públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

CREATE POLICY "Usuários podem deletar seus próprios arquivos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Habilitar Realtime para typing indicators
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_indicators;