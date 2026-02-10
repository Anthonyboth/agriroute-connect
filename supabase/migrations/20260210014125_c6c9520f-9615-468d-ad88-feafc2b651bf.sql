
-- ============================================================================
-- MATCH DEBUG LOGS: Instrumentação e rastreabilidade do match feed
-- Permite auditoria determinística de "por que entrou / por que não entrou"
-- ============================================================================

-- 1) TABELA
CREATE TABLE public.match_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID NOT NULL,
  viewer_role TEXT NOT NULL CHECK (viewer_role IN ('MOTORISTA','TRANSPORTADORA','PRESTADOR_SERVICOS','PRODUTOR','GUEST','ADMIN')),
  feed_type TEXT NOT NULL CHECK (feed_type IN ('DRIVER_FEED','PROVIDER_FEED','COMPANY_FEED')),
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NULL
);

-- 2) ÍNDICES
CREATE INDEX idx_match_debug_viewer_started ON public.match_debug_logs (viewer_user_id, started_at DESC);
CREATE INDEX idx_match_debug_request ON public.match_debug_logs (request_id);

-- 3) RLS
ALTER TABLE public.match_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debug logs"
  ON public.match_debug_logs FOR SELECT
  USING (auth.uid() = viewer_user_id);

CREATE POLICY "Users can insert own debug logs"
  ON public.match_debug_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = viewer_user_id);

CREATE POLICY "Users can update own debug logs"
  ON public.match_debug_logs FOR UPDATE
  USING (auth.uid() = viewer_user_id);

-- No DELETE policy

-- 4) RPC: start_match_debug
CREATE OR REPLACE FUNCTION public.start_match_debug(
  p_feed_type TEXT,
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Get viewer role from profile
  SELECT COALESCE(p.active_mode, p.role) INTO v_role
  FROM profiles p WHERE p.user_id = auth.uid()
  LIMIT 1;

  v_request_id := gen_random_uuid();

  INSERT INTO public.match_debug_logs (
    viewer_user_id, viewer_role, feed_type, request_id, filters
  ) VALUES (
    auth.uid(),
    COALESCE(v_role, 'GUEST'),
    p_feed_type,
    v_request_id,
    p_filters
  );

  RETURN v_request_id;
END;
$$;

-- 5) RPC: finish_match_debug
CREATE OR REPLACE FUNCTION public.finish_match_debug(
  p_request_id UUID,
  p_stats JSONB DEFAULT '{}'::jsonb,
  p_sample JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_capped_sample JSONB;
  v_included JSONB;
  v_excluded JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Cap sample to 20 items total (10 included + 10 excluded)
  v_included := COALESCE(p_sample->'included', '[]'::jsonb);
  v_excluded := COALESCE(p_sample->'excluded', '[]'::jsonb);

  IF jsonb_array_length(v_included) > 10 THEN
    v_included := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_included) AS elem LIMIT 10) sub);
  END IF;

  IF jsonb_array_length(v_excluded) > 10 THEN
    v_excluded := (SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(v_excluded) AS elem LIMIT 10) sub);
  END IF;

  v_capped_sample := jsonb_build_object('included', v_included, 'excluded', v_excluded);

  UPDATE public.match_debug_logs
  SET finished_at = now(),
      stats = p_stats,
      sample = v_capped_sample,
      error = p_error
  WHERE request_id = p_request_id
    AND viewer_user_id = auth.uid();
END;
$$;

-- 6) Cleanup: auto-delete logs older than 7 days (via scheduled cleanup or manual)
CREATE OR REPLACE FUNCTION public.cleanup_match_debug_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.match_debug_logs
  WHERE started_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
