-- ============================================
-- Realtime configuration
-- ============================================

-- Ensure REPLICA IDENTITY FULL for complete payloads
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.affiliated_drivers_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.company_driver_chats REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliated_drivers_tracking;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_driver_chats;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;