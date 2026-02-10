
-- =============================================
-- match_interactions: Learning leve para scoring
-- Registra ações do usuário no feed (sem PII)
-- =============================================
CREATE TABLE public.match_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NULL,
  role text NOT NULL CHECK (role IN ('MOTORISTA','TRANSPORTADORA','PRESTADOR_SERVICOS','PRODUTOR')),
  item_kind text NOT NULL CHECK (item_kind IN ('FREIGHT','SERVICE')),
  item_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('viewed','opened','accepted','rejected','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_match_interactions_user_action ON public.match_interactions(user_id, action, created_at DESC);
CREATE INDEX idx_match_interactions_item ON public.match_interactions(item_id, action);
CREATE INDEX idx_match_interactions_user_kind ON public.match_interactions(user_id, item_kind, action, created_at DESC);

-- RLS
ALTER TABLE public.match_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interactions"
  ON public.match_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
  ON public.match_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE allowed

-- =============================================
-- RPC: get_user_interaction_summary
-- Returns acceptance counts by item_kind for scoring boost
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_interaction_summary(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(key, val),
    '{}'::jsonb
  )
  FROM (
    SELECT 
      item_kind || '_' || action AS key,
      count(*)::int AS val
    FROM match_interactions
    WHERE user_id = p_user_id
      AND created_at > now() - (p_days || ' days')::interval
    GROUP BY item_kind, action
  ) sub;
$$;

-- =============================================
-- Cleanup: remove interactions older than 90 days
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_match_interactions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.match_interactions
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
