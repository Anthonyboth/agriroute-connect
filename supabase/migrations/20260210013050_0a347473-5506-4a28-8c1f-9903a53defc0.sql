
-- ============================================================================
-- MATCH EXPOSURES: Deduplicação e controle de visibilidade do feed
-- Segurança P0: evita repetição, garante isolamento por usuário
-- ============================================================================

-- 1) TABELA
CREATE TABLE public.match_exposures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('FREIGHT', 'SERVICE')),
  item_id UUID NOT NULL,
  city_id UUID NULL,
  distance_km NUMERIC NULL,
  score INT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'SEEN' CHECK (status IN ('SEEN', 'DISMISSED', 'ACCEPTED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT match_exposures_unique UNIQUE (viewer_user_id, item_type, item_id)
);

-- 2) ÍNDICES
CREATE INDEX idx_match_exposures_viewer_expires ON public.match_exposures (viewer_user_id, expires_at);
CREATE INDEX idx_match_exposures_item ON public.match_exposures (item_type, item_id);

-- 3) RLS
ALTER TABLE public.match_exposures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exposures"
  ON public.match_exposures FOR SELECT
  USING (auth.uid() = viewer_user_id);

CREATE POLICY "Users can insert own exposures"
  ON public.match_exposures FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = viewer_user_id);

CREATE POLICY "Users can update own exposures"
  ON public.match_exposures FOR UPDATE
  USING (auth.uid() = viewer_user_id);

-- No DELETE policy = imutabilidade parcial

-- 4) FUNÇÃO: register_match_exposure (upsert com dedupe)
CREATE OR REPLACE FUNCTION public.register_match_exposure(
  p_item_type TEXT,
  p_item_id UUID,
  p_city_id UUID DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT NULL,
  p_ttl_minutes INT DEFAULT 10
)
RETURNS public.match_exposures
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result public.match_exposures;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.match_exposures (
    viewer_user_id, item_type, item_id, city_id, distance_km, expires_at
  ) VALUES (
    auth.uid(), p_item_type, p_item_id, p_city_id, p_distance_km,
    now() + (p_ttl_minutes || ' minutes')::interval
  )
  ON CONFLICT (viewer_user_id, item_type, item_id) DO UPDATE SET
    seen_count = match_exposures.seen_count + 1,
    last_seen_at = now(),
    expires_at = now() + (p_ttl_minutes || ' minutes')::interval,
    distance_km = COALESCE(EXCLUDED.distance_km, match_exposures.distance_km),
    city_id = COALESCE(EXCLUDED.city_id, match_exposures.city_id),
    -- Nunca regredir de ACCEPTED
    status = CASE 
      WHEN match_exposures.status = 'ACCEPTED' THEN 'ACCEPTED'
      ELSE 'SEEN'
    END
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 5) FUNÇÃO: register_match_exposures_batch (batch upsert)
CREATE OR REPLACE FUNCTION public.register_match_exposures_batch(
  p_items JSONB,
  p_ttl_minutes INT DEFAULT 10
)
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_item JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.match_exposures (
      viewer_user_id, item_type, item_id, city_id, distance_km, expires_at
    ) VALUES (
      auth.uid(),
      v_item->>'item_type',
      (v_item->>'item_id')::UUID,
      (v_item->>'city_id')::UUID,
      (v_item->>'distance_km')::NUMERIC,
      now() + (p_ttl_minutes || ' minutes')::interval
    )
    ON CONFLICT (viewer_user_id, item_type, item_id) DO UPDATE SET
      seen_count = match_exposures.seen_count + 1,
      last_seen_at = now(),
      expires_at = now() + (p_ttl_minutes || ' minutes')::interval,
      distance_km = COALESCE(EXCLUDED.distance_km, match_exposures.distance_km),
      city_id = COALESCE(EXCLUDED.city_id, match_exposures.city_id),
      status = CASE 
        WHEN match_exposures.status = 'ACCEPTED' THEN 'ACCEPTED'
        ELSE 'SEEN'
      END;
    
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 6) FUNÇÃO: dismiss_match_exposure
CREATE OR REPLACE FUNCTION public.dismiss_match_exposure(
  p_item_type TEXT,
  p_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.match_exposures
  SET status = 'DISMISSED',
      last_seen_at = now(),
      expires_at = now() + interval '24 hours'
  WHERE viewer_user_id = auth.uid()
    AND item_type = p_item_type
    AND item_id = p_item_id
    AND status != 'ACCEPTED';
END;
$$;

-- 7) FUNÇÃO: accept_match_exposure
CREATE OR REPLACE FUNCTION public.accept_match_exposure(
  p_item_type TEXT,
  p_item_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.match_exposures (
    viewer_user_id, item_type, item_id, status, expires_at
  ) VALUES (
    auth.uid(), p_item_type, p_item_id, 'ACCEPTED', now() + interval '365 days'
  )
  ON CONFLICT (viewer_user_id, item_type, item_id) DO UPDATE SET
    status = 'ACCEPTED',
    last_seen_at = now(),
    expires_at = now() + interval '365 days';
END;
$$;

-- 8) FUNÇÃO: clear_expired_exposures (para botão "Atualizar")
CREATE OR REPLACE FUNCTION public.clear_expired_exposures()
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.match_exposures
  SET expires_at = now(),
      status = 'EXPIRED'
  WHERE viewer_user_id = auth.uid()
    AND status = 'SEEN'
    AND expires_at > now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
