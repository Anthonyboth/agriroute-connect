
-- Drop the old overload with json parameter that conflicts with the jsonb version
DROP FUNCTION IF EXISTS public.get_reports_dashboard(text, uuid, timestamp with time zone, timestamp with time zone, json);
