-- Fix ambiguous column reference in RLS policies

-- Enable RLS on new tables
ALTER TABLE public.driver_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_matches ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.driver_notification_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_service_areas
CREATE POLICY "Drivers can manage their own service areas" 
ON public.driver_service_areas
FOR ALL
USING (driver_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Authenticated users can view active service areas"
ON public.driver_service_areas  
FOR SELECT
USING (is_active = true);

-- RLS policies for freight_matches - fix ambiguous column reference
CREATE POLICY "Users can view matches for their freights or as matched drivers"
ON public.freight_matches
FOR SELECT  
USING (
  freight_id IN (
    SELECT f.id FROM public.freights f 
    JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
    WHERE p.user_id = auth.uid()
  )
  OR driver_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR is_admin()
);

CREATE POLICY "System can manage freight matches"
ON public.freight_matches
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for driver_notification_limits  
CREATE POLICY "Drivers can view their own notification limits"
ON public.driver_notification_limits
FOR SELECT
USING (driver_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "System can manage notification limits" 
ON public.driver_notification_limits
FOR ALL
USING (true)
WITH CHECK (true);