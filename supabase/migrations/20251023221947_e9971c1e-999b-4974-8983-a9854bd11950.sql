-- Add chat_closed_by column to track which users have closed conversations
ALTER TABLE freight_messages ADD COLUMN IF NOT EXISTS chat_closed_by JSONB DEFAULT '{}';
ALTER TABLE service_messages ADD COLUMN IF NOT EXISTS chat_closed_by JSONB DEFAULT '{}';
ALTER TABLE company_driver_chats ADD COLUMN IF NOT EXISTS chat_closed_by JSONB DEFAULT '{}';
ALTER TABLE company_internal_messages ADD COLUMN IF NOT EXISTS chat_closed_by JSONB DEFAULT '{}';

-- Configure Realtime for message tables
ALTER TABLE freight_messages REPLICA IDENTITY FULL;
ALTER TABLE service_messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'freight_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'service_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'document_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_requests;
  END IF;
END $$;