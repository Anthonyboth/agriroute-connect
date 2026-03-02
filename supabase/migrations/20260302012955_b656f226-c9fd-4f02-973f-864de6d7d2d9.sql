
-- 1. Create forum_votes table
CREATE TABLE public.forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('THREAD', 'POST')),
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  value integer NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_vote UNIQUE (user_id, target_type, thread_id, post_id),
  CONSTRAINT vote_target_check CHECK (
    (target_type = 'THREAD' AND thread_id IS NOT NULL AND post_id IS NULL) OR
    (target_type = 'POST' AND post_id IS NOT NULL AND thread_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_forum_votes_thread ON public.forum_votes(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_forum_votes_post ON public.forum_votes(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_forum_votes_user ON public.forum_votes(user_id);

-- 2. Add reply_to_post_id to forum_posts for threaded comments
ALTER TABLE public.forum_posts 
  ADD COLUMN reply_to_post_id uuid REFERENCES public.forum_posts(id) ON DELETE SET NULL;

CREATE INDEX idx_forum_posts_threaded ON public.forum_posts(thread_id, reply_to_post_id, created_at);

-- 3. Enable RLS on forum_votes
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read votes
CREATE POLICY "forum_votes_select"
  ON public.forum_votes
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "forum_votes_insert"
  ON public.forum_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own votes (change vote direction)
CREATE POLICY "forum_votes_update"
  ON public.forum_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own votes (un-vote)
CREATE POLICY "forum_votes_delete"
  ON public.forum_votes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Create view for thread scores (aggregated)
CREATE OR REPLACE VIEW public.forum_thread_scores AS
SELECT 
  t.id AS thread_id,
  COALESCE(SUM(v.value), 0)::integer AS score,
  COUNT(v.id) FILTER (WHERE v.value = 1)::integer AS upvotes,
  COUNT(v.id) FILTER (WHERE v.value = -1)::integer AS downvotes
FROM public.forum_threads t
LEFT JOIN public.forum_votes v ON v.thread_id = t.id AND v.target_type = 'THREAD'
GROUP BY t.id;

-- 5. Create view for post scores (aggregated)
CREATE OR REPLACE VIEW public.forum_post_scores AS
SELECT 
  p.id AS post_id,
  COALESCE(SUM(v.value), 0)::integer AS score,
  COUNT(v.id) FILTER (WHERE v.value = 1)::integer AS upvotes,
  COUNT(v.id) FILTER (WHERE v.value = -1)::integer AS downvotes
FROM public.forum_posts p
LEFT JOIN public.forum_votes v ON v.post_id = p.id AND v.target_type = 'POST'
GROUP BY p.id;

-- 6. Create view for thread comment counts
CREATE OR REPLACE VIEW public.forum_thread_comment_counts AS
SELECT
  thread_id,
  COUNT(*)::integer AS comment_count
FROM public.forum_posts
WHERE is_deleted = false
GROUP BY thread_id;
