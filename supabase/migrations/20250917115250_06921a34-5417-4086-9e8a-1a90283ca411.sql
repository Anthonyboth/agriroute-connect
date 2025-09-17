-- Ensure RLS and proper policies for freight_messages so producers and drivers can exchange messages (including counter-proposals)

-- Enable Row Level Security
ALTER TABLE public.freight_messages ENABLE ROW LEVEL SECURITY;

-- Policy: participants (producer or driver of the freight) can read messages
CREATE POLICY IF NOT EXISTS "freight_messages_select_participants"
ON public.freight_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.freights f
    WHERE f.id = freight_messages.freight_id
      AND (f.producer_id = auth.uid() OR f.driver_id = auth.uid())
  )
);

-- Policy: only participants can insert and the sender must be the logged-in user
CREATE POLICY IF NOT EXISTS "freight_messages_insert_sender_is_participant"
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

-- Policy: updates only by original sender
CREATE POLICY IF NOT EXISTS "freight_messages_update_by_sender"
ON public.freight_messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Policy: allow delete by sender or the producer (owner of the freight)
CREATE POLICY IF NOT EXISTS "freight_messages_delete_by_sender_or_producer"
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
