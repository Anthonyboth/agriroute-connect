-- Forum rate limiting functions (server-side enforcement)

-- Rate limit check: returns TRUE if action is allowed
CREATE OR REPLACE FUNCTION public.forum_check_rate_limit(
  p_user_id uuid,
  p_action text, -- 'thread' or 'post'
  p_max_per_minute int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_action = 'thread' THEN
    SELECT COUNT(*) INTO v_count
    FROM forum_threads
    WHERE author_user_id = p_user_id
      AND created_at > now() - interval '1 minute';
  ELSIF p_action = 'post' THEN
    SELECT COUNT(*) INTO v_count
    FROM forum_posts
    WHERE author_user_id = p_user_id
      AND created_at > now() - interval '1 minute';
  ELSE
    RETURN false;
  END IF;
  
  RETURN v_count < p_max_per_minute;
END;
$$;

-- Add RLS policy using rate limit for thread creation
CREATE OR REPLACE FUNCTION public.forum_enforce_thread_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT forum_check_rate_limit(NEW.author_user_id, 'thread', 3) THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 3 threads per minute';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.forum_enforce_post_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT forum_check_rate_limit(NEW.author_user_id, 'post', 10) THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 posts per minute';
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_forum_thread_rate_limit ON forum_threads;
CREATE TRIGGER trg_forum_thread_rate_limit
  BEFORE INSERT ON forum_threads
  FOR EACH ROW
  EXECUTE FUNCTION forum_enforce_thread_rate_limit();

DROP TRIGGER IF EXISTS trg_forum_post_rate_limit ON forum_posts;
CREATE TRIGGER trg_forum_post_rate_limit
  BEFORE INSERT ON forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION forum_enforce_post_rate_limit();