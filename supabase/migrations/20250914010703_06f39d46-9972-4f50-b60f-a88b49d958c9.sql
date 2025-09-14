-- Add table for flexible freight proposals
CREATE TABLE IF NOT EXISTS public.flexible_freight_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID REFERENCES public.freights(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_date DATE NOT NULL,
  original_date DATE NOT NULL,
  days_difference INTEGER NOT NULL,
  proposed_price NUMERIC(12,2) NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(freight_id, driver_id)
);

-- Add RLS policies for flexible proposals
ALTER TABLE public.flexible_freight_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant flexible proposals" ON public.flexible_freight_proposals
FOR SELECT USING (
  driver_id = auth.uid() OR 
  freight_id IN (
    SELECT id FROM public.freights WHERE producer_id = auth.uid()
  )
);

CREATE POLICY "Drivers can create flexible proposals" ON public.flexible_freight_proposals
FOR INSERT WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Producers can update flexible proposal status" ON public.flexible_freight_proposals
FOR UPDATE USING (
  freight_id IN (
    SELECT id FROM public.freights WHERE producer_id = auth.uid()
  )
);

-- Add table for freight messages (chat system)
CREATE TABLE IF NOT EXISTS public.freight_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID REFERENCES public.freights(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for freight messages
ALTER TABLE public.freight_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their freights" ON public.freight_messages
FOR SELECT USING (
  sender_id = auth.uid() OR 
  freight_id IN (
    SELECT id FROM public.freights 
    WHERE producer_id = auth.uid() OR driver_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages for their freights" ON public.freight_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  freight_id IN (
    SELECT id FROM public.freights 
    WHERE producer_id = auth.uid() OR driver_id = auth.uid()
  )
);

-- Add validation history table for automatic approval
CREATE TABLE IF NOT EXISTS public.validation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for validation history
ALTER TABLE public.validation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own validation history" ON public.validation_history
FOR SELECT USING (
  profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Create storage bucket for freight attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('freight-attachments', 'freight-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for freight attachments
CREATE POLICY "Users can view attachments for their freights" ON storage.objects
FOR SELECT USING (
  bucket_id = 'freight-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload freight attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'freight-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_flexible_freight_proposals_updated_at
  BEFORE UPDATE ON public.flexible_freight_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_freight_messages_updated_at
  BEFORE UPDATE ON public.freight_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add notification function
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info'
)
RETURNS VOID AS $$
BEGIN
  -- For now, just log the notification
  -- In production, this would integrate with your notification service
  RAISE NOTICE 'Notification for %: % - %', p_user_id, p_title, p_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;