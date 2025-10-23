-- Configure Realtime for the tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.affiliated_drivers_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.company_driver_chats REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  -- Add profiles to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  -- Add affiliated_drivers_tracking to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'affiliated_drivers_tracking'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliated_drivers_tracking;
  END IF;

  -- Add company_driver_chats to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public'
    AND tablename = 'company_driver_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_driver_chats;
  END IF;
END $$;