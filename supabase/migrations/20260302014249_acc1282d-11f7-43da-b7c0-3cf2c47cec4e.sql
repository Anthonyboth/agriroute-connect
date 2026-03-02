
-- 1. Add marketplace columns to forum_boards
ALTER TABLE public.forum_boards 
  ADD COLUMN IF NOT EXISTS requires_flair boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_flairs text[] DEFAULT ARRAY['GERAL','VENDA','COMPRA','SERVICO','FRETE','PARCERIA','DUVIDA'],
  ADD COLUMN IF NOT EXISTS requires_market_fields_for_flairs text[] DEFAULT ARRAY['VENDA','COMPRA','SERVICO','FRETE'],
  ADD COLUMN IF NOT EXISTS block_phone_in_body boolean DEFAULT false;

-- 2. Add marketplace columns to forum_threads
ALTER TABLE public.forum_threads
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS availability_date date,
  ADD COLUMN IF NOT EXISTS automod_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_auto_hidden boolean DEFAULT false;

-- 3. Create forum_saves table
CREATE TABLE IF NOT EXISTS public.forum_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, thread_id)
);

ALTER TABLE public.forum_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_saves_select_own" ON public.forum_saves
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "forum_saves_insert_own" ON public.forum_saves
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "forum_saves_delete_own" ON public.forum_saves
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Create forum_board_rules table
CREATE TABLE IF NOT EXISTS public.forum_board_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.forum_boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_board_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_board_rules_select_all" ON public.forum_board_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "forum_board_rules_insert_auth" ON public.forum_board_rules
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "forum_board_rules_update_auth" ON public.forum_board_rules
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "forum_board_rules_delete_auth" ON public.forum_board_rules
  FOR DELETE TO authenticated USING (true);

-- 5. Create forum_user_karma view
CREATE OR REPLACE VIEW public.forum_user_karma AS
SELECT 
  u.user_id,
  COALESCE(thread_karma.score, 0) + COALESCE(post_karma.score, 0) AS karma,
  COALESCE(thread_count.cnt, 0) AS thread_count,
  COALESCE(post_count.cnt, 0) AS post_count
FROM (
  -- All users who have threads or posts
  SELECT DISTINCT author_user_id AS user_id FROM public.forum_threads
  UNION
  SELECT DISTINCT author_user_id AS user_id FROM public.forum_posts WHERE is_deleted = false
) u
LEFT JOIN (
  -- Karma from thread votes received
  SELECT t.author_user_id AS user_id, COALESCE(SUM(v.value), 0) AS score
  FROM public.forum_threads t
  JOIN public.forum_votes v ON v.target_type = 'THREAD' AND v.thread_id = t.id
  GROUP BY t.author_user_id
) thread_karma ON thread_karma.user_id = u.user_id
LEFT JOIN (
  -- Karma from post votes received
  SELECT p.author_user_id AS user_id, COALESCE(SUM(v.value), 0) AS score
  FROM public.forum_posts p
  JOIN public.forum_votes v ON v.target_type = 'POST' AND v.post_id = p.id
  WHERE p.is_deleted = false
  GROUP BY p.author_user_id
) post_karma ON post_karma.user_id = u.user_id
LEFT JOIN (
  SELECT author_user_id AS user_id, COUNT(*) AS cnt FROM public.forum_threads GROUP BY author_user_id
) thread_count ON thread_count.user_id = u.user_id
LEFT JOIN (
  SELECT author_user_id AS user_id, COUNT(*) AS cnt FROM public.forum_posts WHERE is_deleted = false GROUP BY author_user_id
) post_count ON post_count.user_id = u.user_id;

-- 6. Grant access
GRANT SELECT ON public.forum_user_karma TO authenticated, anon;
GRANT ALL ON public.forum_saves TO authenticated;
GRANT ALL ON public.forum_board_rules TO authenticated;
