-- Atualizar bucket chat-interno-files para aceitar áudio e vídeo além dos documentos
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  -- Documentos existentes
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  -- Áudio (novos)
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  -- Vídeo (novos)
  'video/mp4',
  'video/webm',
  'video/quicktime'
],
file_size_limit = 52428800  -- 50MB para suportar vídeos maiores
WHERE name = 'chat-interno-files';