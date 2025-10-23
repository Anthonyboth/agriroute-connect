-- Realtime configuration for tables
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.affiliated_drivers_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.company_driver_chats REPLICA IDENTITY FULL;