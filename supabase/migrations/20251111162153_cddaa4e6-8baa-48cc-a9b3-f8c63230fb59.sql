-- Create proposal_chat_messages table for direct negotiation chat
CREATE TABLE IF NOT EXISTS public.proposal_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.freight_proposals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'file')),
  content TEXT,
  image_url TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_content CHECK (
    (message_type = 'text' AND content IS NOT NULL) OR
    (message_type = 'image' AND image_url IS NOT NULL) OR
    (message_type = 'file' AND file_url IS NOT NULL AND file_name IS NOT NULL)
  )
);

-- Create indexes for performance
CREATE INDEX idx_proposal_chat_messages_proposal_id ON public.proposal_chat_messages(proposal_id);
CREATE INDEX idx_proposal_chat_messages_created_at ON public.proposal_chat_messages(created_at DESC);
CREATE INDEX idx_proposal_chat_messages_sender_id ON public.proposal_chat_messages(sender_id);

-- Enable RLS
ALTER TABLE public.proposal_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view messages for proposals they are part of (producer or driver)
CREATE POLICY "Users can view proposal chat messages they are part of"
ON public.proposal_chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.freight_proposals fp
    JOIN public.freights f ON fp.freight_id = f.id
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE fp.id = proposal_chat_messages.proposal_id
    AND (f.producer_id = p.id OR fp.driver_id = p.id)
  )
);

-- RLS Policy: Users can insert messages for proposals they are part of
CREATE POLICY "Users can send proposal chat messages they are part of"
ON public.proposal_chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freight_proposals fp
    JOIN public.freights f ON fp.freight_id = f.id
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE fp.id = proposal_chat_messages.proposal_id
    AND (f.producer_id = p.id OR fp.driver_id = p.id)
    AND p.id = proposal_chat_messages.sender_id
  )
);

-- RLS Policy: Users can update read_at for messages they receive
CREATE POLICY "Users can mark proposal chat messages as read"
ON public.proposal_chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.freight_proposals fp
    JOIN public.freights f ON fp.freight_id = f.id
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE fp.id = proposal_chat_messages.proposal_id
    AND (f.producer_id = p.id OR fp.driver_id = p.id)
    AND p.id != proposal_chat_messages.sender_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.freight_proposals fp
    JOIN public.freights f ON fp.freight_id = f.id
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE fp.id = proposal_chat_messages.proposal_id
    AND (f.producer_id = p.id OR fp.driver_id = p.id)
    AND p.id != proposal_chat_messages.sender_id
  )
);

-- RLS Policy: Admins can manage all proposal chat messages
CREATE POLICY "Admins can manage all proposal chat messages"
ON public.proposal_chat_messages
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for proposal_chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposal_chat_messages;