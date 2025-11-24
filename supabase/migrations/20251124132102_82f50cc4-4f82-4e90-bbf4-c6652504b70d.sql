-- Adicionar coluna metadata à tabela system_announcements
ALTER TABLE system_announcements 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Atualizar o anúncio existente com a nova mensagem sobre fase experimental
UPDATE system_announcements
SET 
  title = '📣 Aviso',
  message = 'O app está em fase experimental, podendo apresentar alguns erros ou bugs. Se algo não funcionar como esperado, use o site, que está 100% estável.

Pedimos desculpas pelo transtorno — atualizações serão liberadas em breve.

Suporte: 07h às 19h (seg–sex).',
  type = 'warning',
  category = 'informativo',
  metadata = jsonb_build_object(
    'whatsapp', '5566999426656',
    'whatsapp_message', 'Olá! Preciso de suporte no AgriRoute'
  ),
  updated_at = now()
WHERE id = '3bf29a08-13e5-4020-b1b9-6fa3f892def1';