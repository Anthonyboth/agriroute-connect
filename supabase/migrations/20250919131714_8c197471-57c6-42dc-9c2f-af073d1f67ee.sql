-- Create freight_advances table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.freight_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  producer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_amount NUMERIC NOT NULL,
  approved_amount NUMERIC,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  payment_method TEXT NOT NULL DEFAULT 'PIX',
  stripe_payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freight_advances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Drivers can request advances" 
ON public.freight_advances 
FOR INSERT 
WITH CHECK (
  driver_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'MOTORISTA'
  )
);

CREATE POLICY "Users can view advances for their freights" 
ON public.freight_advances 
FOR SELECT 
USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) 
  OR producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR is_admin()
);

CREATE POLICY "Producers can approve advances" 
ON public.freight_advances 
FOR UPDATE 
USING (
  producer_id IN (
    SELECT id FROM profiles 
    WHERE user_id = auth.uid() AND role = 'PRODUTOR'
  ) 
  OR is_admin()
);

-- Create trigger for updated_at
CREATE TRIGGER update_freight_advances_updated_at
  BEFORE UPDATE ON public.freight_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();