-- 1) Fix linter: add RLS policy on encryption_keys (deny all by default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='encryption_keys' AND policyname='encryption_keys_deny_all'
  ) THEN
    CREATE POLICY encryption_keys_deny_all ON public.encryption_keys FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- 2) Trip progress audit table (monitoring)
CREATE TABLE IF NOT EXISTS public.trip_progress_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id uuid NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  driver_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_status text NULL,
  new_status text NULL,
  success boolean NOT NULL DEFAULT false,
  error_code text NULL,
  error_message text NULL,
  execution_ms integer NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_progress_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trip_progress_audit_freight ON public.trip_progress_audit(freight_id);
CREATE INDEX IF NOT EXISTS idx_trip_progress_audit_driver ON public.trip_progress_audit(driver_profile_id);
CREATE INDEX IF NOT EXISTS idx_trip_progress_audit_created ON public.trip_progress_audit(created_at DESC);

-- 3) RLS Policies for trip_progress_audit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_progress_audit' AND policyname='trip_progress_audit_select_admin') THEN
    CREATE POLICY trip_progress_audit_select_admin ON public.trip_progress_audit FOR SELECT USING (auth.role() = 'service_role' OR public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_progress_audit' AND policyname='trip_progress_audit_insert_own') THEN
    CREATE POLICY trip_progress_audit_insert_own ON public.trip_progress_audit FOR INSERT WITH CHECK (auth.role() = 'service_role' OR driver_profile_id = public.current_profile_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_progress_audit' AND policyname='trip_progress_audit_deny_update') THEN
    CREATE POLICY trip_progress_audit_deny_update ON public.trip_progress_audit FOR UPDATE USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trip_progress_audit' AND policyname='trip_progress_audit_deny_delete') THEN
    CREATE POLICY trip_progress_audit_deny_delete ON public.trip_progress_audit FOR DELETE USING (false);
  END IF;
END $$;