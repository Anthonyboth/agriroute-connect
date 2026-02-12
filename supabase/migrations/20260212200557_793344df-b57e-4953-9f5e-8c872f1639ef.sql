
-- Fix: Grant SELECT on columns needed by useAuth.ts fetchProfile query
-- These were accidentally blocked by the column-level security migration

GRANT SELECT (cnh_expiry_date, cnh_category, selfie_url) ON public.profiles TO authenticated;
