-- Ensure RLS and proper policies for freight_messages so producers and drivers can exchange messages (including counter-proposals)

-- Enable Row Level Security (idempotent)
ALTER TABLE public.freight_messages ENABLE ROW LEVEL SECURITY;

-- Create SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'freight_messages' 
      AND policyname = 'freight_messages_select_participants'
  ) THEN
    CREATE POLICY "freight_messages_select_participants"
    ON public.freight_messages
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.freights f
        WHERE f.id = freight_messages.freight_id
          AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
      )
    );
  END IF;
END$$;

-- Create INSERT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'freight_messages' 
      AND policyname = 'freight_messages_insert_sender_is_participant'
  ) THEN
    CREATE POLICY "freight_messages_insert_sender_is_participant"
    ON public.freight_messages
    FOR INSERT
    WITH CHECK (
      sender_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.freights f
        WHERE f.id = freight_messages.freight_id
          AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
      )
    );
  END IF;
END$$;

-- Create UPDATE policy if missing (sender only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'freight_messages' 
      AND policyname = 'freight_messages_update_by_sender'
  ) THEN
    CREATE POLICY "freight_messages_update_by_sender"
    ON public.freight_messages
    FOR UPDATE
    USING (sender_id = auth.uid())
    WITH CHECK (sender_id = auth.uid());
  END IF;
END$$;

-- Create DELETE policy if missing (sender or producer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'freight_messages' 
      AND policyname = 'freight_messages_delete_by_sender_or_producer'
  ) THEN
    CREATE POLICY "freight_messages_delete_by_sender_or_producer"
    ON public.freight_messages
    FOR DELETE
    USING (
      sender_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.freights f
        WHERE f.id = freight_messages.freight_id
          AND f.producer_id = auth.uid()
      )
    );
  END IF;
END$$;
