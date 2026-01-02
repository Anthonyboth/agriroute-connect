-- ============================================
-- FIX: RLS Policy for tracking_settings (using valid app_role values)
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Tracking settings are viewable by admins only" ON public.tracking_settings;
DROP POLICY IF EXISTS "Anyone can view tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Public read access to tracking_settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Authenticated users can view tracking_settings" ON public.tracking_settings;

-- Create policy: Only admins can read tracking settings
CREATE POLICY "Tracking settings are viewable by admins only"
ON public.tracking_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);