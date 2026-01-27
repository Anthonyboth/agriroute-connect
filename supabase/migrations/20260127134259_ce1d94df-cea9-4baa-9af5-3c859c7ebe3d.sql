-- Tighten RLS policy role bindings: never grant policies to the 'public' role
-- This prevents any unauthenticated access paths (even if auth.uid() is NULL)
-- and also avoids false positives in automated security scans.

-- Vehicles: restrict previously-public policies to authenticated users only
ALTER POLICY "Admins can manage all vehicles" ON public.vehicles TO authenticated;
ALTER POLICY "Drivers can update their own vehicles" ON public.vehicles TO authenticated;

-- User subscriptions: restrict previously-public policies to authenticated users only
ALTER POLICY "Motoristas can manage their own subscriptions" ON public.user_subscriptions TO authenticated;
ALTER POLICY "Users can create their own subscriptions" ON public.user_subscriptions TO authenticated;
ALTER POLICY "Users can update their own subscriptions" ON public.user_subscriptions TO authenticated;
ALTER POLICY "Users can view their own subscriptions" ON public.user_subscriptions TO authenticated;
