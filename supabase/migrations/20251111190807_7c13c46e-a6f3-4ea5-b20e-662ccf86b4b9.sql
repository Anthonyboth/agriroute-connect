-- Adicionar colunas para anexos de arquivos nas tabelas de mensagens

-- Tabela freight_messages
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'freight_messages' AND column_name = 'file_url') THEN
    ALTER TABLE public.freight_messages ADD COLUMN file_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'freight_messages' AND column_name = 'file_name') THEN
    ALTER TABLE public.freight_messages ADD COLUMN file_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'freight_messages' AND column_name = 'file_size') THEN
    ALTER TABLE public.freight_messages ADD COLUMN file_size INTEGER;
  END IF;
END $$;

-- Tabela service_messages
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'service_messages' AND column_name = 'file_url') THEN
    ALTER TABLE public.service_messages ADD COLUMN file_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'service_messages' AND column_name = 'file_name') THEN
    ALTER TABLE public.service_messages ADD COLUMN file_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'service_messages' AND column_name = 'file_size') THEN
    ALTER TABLE public.service_messages ADD COLUMN file_size INTEGER;
  END IF;
END $$;

-- Tabela company_driver_chats
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'company_driver_chats' AND column_name = 'file_url') THEN
    ALTER TABLE public.company_driver_chats ADD COLUMN file_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'company_driver_chats' AND column_name = 'file_name') THEN
    ALTER TABLE public.company_driver_chats ADD COLUMN file_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'company_driver_chats' AND column_name = 'file_size') THEN
    ALTER TABLE public.company_driver_chats ADD COLUMN file_size INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN public.freight_messages.file_url IS 'URL do arquivo anexado (PDF, Word, Excel, etc.)';
COMMENT ON COLUMN public.freight_messages.file_name IS 'Nome original do arquivo anexado';
COMMENT ON COLUMN public.freight_messages.file_size IS 'Tamanho do arquivo em bytes';