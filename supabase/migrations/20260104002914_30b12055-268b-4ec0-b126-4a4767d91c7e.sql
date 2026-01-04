-- Remove overly permissive policy that exposes all ratings publicly
DROP POLICY IF EXISTS "Users can view ratings for any user" ON public.ratings;