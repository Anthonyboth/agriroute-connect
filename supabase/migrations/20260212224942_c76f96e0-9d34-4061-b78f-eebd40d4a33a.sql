-- Drop the duplicate function with json parameter (keep jsonb version)
DROP FUNCTION IF EXISTS public.get_reports_dashboard(text, uuid, timestamp with time zone, timestamp with time zone, json);
