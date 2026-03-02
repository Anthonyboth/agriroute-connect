-- Enable realtime for service_request_proposals so providers see status changes in real-time
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'service_request_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_request_proposals;
  END IF;
END $$;