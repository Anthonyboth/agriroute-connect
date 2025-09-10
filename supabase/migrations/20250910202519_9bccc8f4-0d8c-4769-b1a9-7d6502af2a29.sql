-- Create notifications table for real-time notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  category TEXT NOT NULL DEFAULT 'GENERAL',
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create loyalty points table
CREATE TABLE public.loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  freight_id UUID,
  action_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user loyalty summary table
CREATE TABLE public.user_loyalty (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'BRONZE',
  completed_freights INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create promotions table
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
  discount_value NUMERIC NOT NULL,
  min_amount NUMERIC,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  referral_bonus INTEGER NOT NULL DEFAULT 100,
  uses INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user referrals table
CREATE TABLE public.user_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  bonus_awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performance metrics table
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create policies for support tickets
CREATE POLICY "Users can view their own tickets or admins can view all" 
ON public.support_tickets FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR is_admin());

CREATE POLICY "Users can create their own tickets" 
ON public.support_tickets FOR INSERT 
WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own tickets or admins can update all" 
ON public.support_tickets FOR UPDATE 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR is_admin());

-- Create policies for support messages
CREATE POLICY "Users can view messages for their tickets or admins can view all" 
ON public.support_messages FOR SELECT 
USING (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR is_admin());

CREATE POLICY "Users can create messages for their tickets or admins can create any" 
ON public.support_messages FOR INSERT 
WITH CHECK (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR is_admin());

-- Create policies for loyalty points
CREATE POLICY "Users can view their own loyalty points" 
ON public.loyalty_points FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR is_admin());

-- Create policies for user loyalty
CREATE POLICY "Users can view their own loyalty status" 
ON public.user_loyalty FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR is_admin());

-- Create policies for promotions
CREATE POLICY "Anyone can view active promotions" 
ON public.promotions FOR SELECT 
USING (active = true);

-- Create policies for referral codes
CREATE POLICY "Users can view their own referral codes" 
ON public.referral_codes FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own referral codes" 
ON public.referral_codes FOR INSERT 
WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create policies for user referrals
CREATE POLICY "Users can view their referrals" 
ON public.user_referrals FOR SELECT 
USING (referrer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR referred_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create policies for performance metrics
CREATE POLICY "Users can view their own performance metrics" 
ON public.performance_metrics FOR SELECT 
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR is_admin());

-- Create function to update loyalty points
CREATE OR REPLACE FUNCTION public.update_loyalty_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update total points for the user
  INSERT INTO public.user_loyalty (user_id, total_points, completed_freights)
  VALUES (NEW.user_id, NEW.points, CASE WHEN NEW.action_type = 'FREIGHT_COMPLETED' THEN 1 ELSE 0 END)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_points = user_loyalty.total_points + NEW.points,
    completed_freights = user_loyalty.completed_freights + CASE WHEN NEW.action_type = 'FREIGHT_COMPLETED' THEN 1 ELSE 0 END,
    tier = CASE 
      WHEN user_loyalty.total_points + NEW.points >= 1000 THEN 'GOLD'
      WHEN user_loyalty.total_points + NEW.points >= 500 THEN 'SILVER'
      ELSE 'BRONZE'
    END,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger for loyalty points
CREATE TRIGGER update_user_loyalty_trigger
AFTER INSERT ON public.loyalty_points
FOR EACH ROW
EXECUTE FUNCTION public.update_loyalty_points();

-- Create function to send notification
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Create triggers for updated_at columns
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_loyalty_updated_at
BEFORE UPDATE ON public.user_loyalty
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_codes_updated_at
BEFORE UPDATE ON public.referral_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;