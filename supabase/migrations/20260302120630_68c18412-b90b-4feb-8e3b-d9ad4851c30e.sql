-- Restrict monitoring/system tables: revoke all from anon for defense in depth
-- These tables already have RLS with auth.uid()-scoped policies, but revoking anon access adds another layer

REVOKE ALL ON public.match_debug_logs FROM anon;
REVOKE ALL ON public.match_exposures FROM anon;
REVOKE ALL ON public.match_interactions FROM anon;
REVOKE ALL ON public.error_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.access_denied_logs FROM anon;
REVOKE ALL ON public.stop_events FROM anon;
REVOKE ALL ON public.auto_confirm_logs FROM anon;
REVOKE ALL ON public.antt_recalculation_history FROM anon;
REVOKE ALL ON public.antt_price_sync_logs FROM anon;
REVOKE ALL ON public.compliance_audit_events FROM anon;
REVOKE ALL ON public.antifraud_feedback FROM anon;
REVOKE ALL ON public.antifraud_nfe_events FROM anon;
REVOKE ALL ON public.api_rate_limits FROM anon;
REVOKE ALL ON public.admin_registration_actions FROM anon;