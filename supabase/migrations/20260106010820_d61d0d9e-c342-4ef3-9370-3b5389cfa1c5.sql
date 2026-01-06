-- Habilitar REPLICA IDENTITY FULL para payloads completos no Realtime
ALTER TABLE public.freights REPLICA IDENTITY FULL;

-- Verificar se a tabela já está na publicação e adicionar se não estiver
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'freights'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.freights;
  END IF;
END $$;