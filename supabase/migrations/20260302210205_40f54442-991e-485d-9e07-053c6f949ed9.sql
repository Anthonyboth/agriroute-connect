-- Fix: Grant EXECUTE permission on get_reports_dashboard to authenticated users
GRANT EXECUTE ON FUNCTION public.get_reports_dashboard(text, uuid, timestamptz, timestamptz, jsonb) TO authenticated;
