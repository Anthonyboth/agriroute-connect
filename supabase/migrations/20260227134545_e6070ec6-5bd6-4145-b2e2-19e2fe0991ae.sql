
-- 1) Tabela de telemetria do match feed
CREATE TABLE IF NOT EXISTS public.match_telemetry (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  env text NOT NULL DEFAULT 'prod',
  check_name text NOT NULL DEFAULT 'feed_synthetic',
  source text NOT NULL DEFAULT 'sentinel',
  role text,
  user_id uuid,
  city_ids_count int NOT NULL DEFAULT 0,
  city_pairs_count int NOT NULL DEFAULT 0,
  rpc_freights_count int NOT NULL DEFAULT 0,
  rpc_services_count int NOT NULL DEFAULT 0,
  displayed_freights_count int NOT NULL DEFAULT 0,
  displayed_services_count int NOT NULL DEFAULT 0,
  feed_total_eligible int,
  feed_total_displayed int,
  duration_ms int,
  ok boolean NOT NULL DEFAULT true,
  failure_code text,
  failure_detail jsonb
);

CREATE INDEX IF NOT EXISTS match_telemetry_created_at_idx ON public.match_telemetry (created_at DESC);
CREATE INDEX IF NOT EXISTS match_telemetry_ok_created_at_idx ON public.match_telemetry (ok, created_at DESC);
CREATE INDEX IF NOT EXISTS match_telemetry_role_created_at_idx ON public.match_telemetry (role, created_at DESC);

ALTER TABLE public.match_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_read_telemetry" ON public.match_telemetry
  FOR SELECT USING (public.is_allowlisted_admin());

CREATE POLICY "service_role_insert_telemetry" ON public.match_telemetry
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- 2) Tabela de estado de alerta (dedupe + recovery)
CREATE TABLE IF NOT EXISTS public.match_alert_state (
  key text PRIMARY KEY,
  is_open boolean NOT NULL DEFAULT false,
  fail_streak int NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  last_ok_at timestamptz,
  last_fail_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_alert_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_read_alert_state" ON public.match_alert_state
  FOR SELECT USING (public.is_allowlisted_admin());

CREATE POLICY "service_role_all_alert_state" ON public.match_alert_state
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
