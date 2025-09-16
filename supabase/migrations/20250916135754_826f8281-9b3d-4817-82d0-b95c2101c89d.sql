-- Create reports table for user reports/complaints
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id UUID NOT NULL,
  reported_user_name TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'CONDUCT',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create reports" 
ON public.user_reports 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own reports" 
ON public.user_reports 
FOR SELECT 
USING (reporter_id = auth.uid());

CREATE POLICY "Admins can view all reports" 
ON public.user_reports 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can update reports" 
ON public.user_reports 
FOR UPDATE 
USING (is_admin());

-- Add updated_at trigger
CREATE TRIGGER update_user_reports_updated_at
BEFORE UPDATE ON public.user_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();