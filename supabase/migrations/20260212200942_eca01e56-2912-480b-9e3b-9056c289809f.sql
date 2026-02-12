-- Fix: Grant SELECT on columns needed by service_requests_secure view and frontend JOINs
-- The view subqueries profiles for id/user_id to check ownership
-- The frontend JOINs profiles for provider display info

GRANT SELECT (id, user_id, full_name, phone, rating, profile_photo_url, role) ON public.profiles TO authenticated;
