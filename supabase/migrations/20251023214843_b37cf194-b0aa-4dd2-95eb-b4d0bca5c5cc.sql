-- ============================================
-- RLS Policies for company_driver_chats
-- ============================================

-- Enable RLS (if not already enabled)
ALTER TABLE public.company_driver_chats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "cdc_select_by_participants" ON public.company_driver_chats;
DROP POLICY IF EXISTS "cdc_insert_by_company_owner" ON public.company_driver_chats;
DROP POLICY IF EXISTS "cdc_insert_by_driver" ON public.company_driver_chats;
DROP POLICY IF EXISTS "cdc_mark_read_by_recipient" ON public.company_driver_chats;

-- SELECT: Company owner and driver can read their chat messages
CREATE POLICY "cdc_select_by_participants"
ON public.company_driver_chats
FOR SELECT
TO authenticated
USING (
  -- Driver can read their messages
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR
  -- Company owner can read messages from their company
  EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- INSERT: Company owner can send messages as COMPANY
CREATE POLICY "cdc_insert_by_company_owner"
ON public.company_driver_chats
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'COMPANY'
  AND EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- INSERT: Driver can send messages as DRIVER
CREATE POLICY "cdc_insert_by_driver"
ON public.company_driver_chats
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'DRIVER'
  AND driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.company_drivers cd
    WHERE cd.company_id = company_id
    AND cd.driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND COALESCE(cd.status, 'APPROVED') IN ('APPROVED', 'ACTIVE')
  )
);

-- UPDATE: Recipients can mark messages as read
CREATE POLICY "cdc_mark_read_by_recipient"
ON public.company_driver_chats
FOR UPDATE
TO authenticated
USING (
  -- Company can mark driver messages as read
  (sender_type = 'DRIVER' AND EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  ))
  OR
  -- Driver can mark company messages as read
  (sender_type = 'COMPANY' AND driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
)
WITH CHECK (true);

-- ============================================
-- RLS Policies for affiliated_drivers_tracking
-- ============================================

-- Enable RLS (if not already enabled)
ALTER TABLE public.affiliated_drivers_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "adt_select_by_company" ON public.affiliated_drivers_tracking;
DROP POLICY IF EXISTS "adt_select_by_driver_self" ON public.affiliated_drivers_tracking;

-- SELECT: Company owner can view tracking of their drivers
CREATE POLICY "adt_select_by_company"
ON public.affiliated_drivers_tracking
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transport_companies tc
    WHERE tc.id = company_id 
    AND tc.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- SELECT: Driver can view their own tracking
CREATE POLICY "adt_select_by_driver_self"
ON public.affiliated_drivers_tracking
FOR SELECT
TO authenticated
USING (
  driver_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- ============================================
-- Realtime configuration
-- ============================================

-- Ensure REPLICA IDENTITY FULL for complete payloads
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.affiliated_drivers_tracking REPLICA IDENTITY FULL;
ALTER TABLE public.company_driver_chats REPLICA IDENTITY FULL;

-- Add tables to realtime publication (if not already added)
DO $$
BEGIN
  -- Add profiles to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  -- Add affiliated_drivers_tracking to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'affiliated_drivers_tracking'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliated_drivers_tracking;
  END IF;

  -- Add company_driver_chats to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'company_driver_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_driver_chats;
  END IF;
END $$;