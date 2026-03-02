
-- =============================================
-- FORUM MODULE - Phase 1/4: Database Schema
-- Isolated: only creates new forum_* tables
-- Does NOT alter any existing tables
-- =============================================

-- ==================
-- 1. TABLES
-- ==================

CREATE TABLE public.forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  visibility TEXT NOT NULL DEFAULT 'PUBLIC'
    CHECK (visibility IN ('PUBLIC','VERIFIED_ONLY','AFFILIATES_ONLY','ADMIN_ONLY')),
  allowed_roles TEXT[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.forum_boards(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  thread_type TEXT NOT NULL DEFAULT 'GERAL'
    CHECK (thread_type IN ('GERAL','VENDA','COMPRA','SERVICO','FRETE','PARCERIA','DUVIDA')),
  price NUMERIC DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  location_text TEXT DEFAULT NULL,
  contact_preference TEXT DEFAULT NULL
    CHECK (contact_preference IS NULL OR contact_preference IN ('CHAT_APP','TELEFONE','WHATSAPP','EMAIL')),
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED','ARCHIVED')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  last_post_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID DEFAULT NULL REFERENCES public.forum_threads(id) ON DELETE SET NULL,
  post_id UUID DEFAULT NULL REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  uploader_user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_thread_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_post_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(thread_id, user_id)
);

CREATE TABLE public.forum_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('THREAD','POST','USER')),
  thread_id UUID DEFAULT NULL REFERENCES public.forum_threads(id) ON DELETE SET NULL,
  post_id UUID DEFAULT NULL REFERENCES public.forum_posts(id) ON DELETE SET NULL,
  target_user_id UUID DEFAULT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('SPAM','GOLPE','OFENSIVO','ILEGAL','DADOS_PESSOAIS','OUTRO')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED','REJECTED')),
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE public.forum_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  banned_by_admin_id UUID NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.forum_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==================
-- 2. INDEXES
-- ==================

CREATE INDEX idx_forum_threads_board_last_post ON public.forum_threads(board_id, last_post_at DESC);
CREATE INDEX idx_forum_posts_thread_created ON public.forum_posts(thread_id, created_at ASC);
CREATE INDEX idx_forum_reports_status_created ON public.forum_reports(status, created_at DESC);
CREATE INDEX idx_forum_threads_author ON public.forum_threads(author_user_id);
CREATE INDEX idx_forum_posts_author ON public.forum_posts(author_user_id);
CREATE INDEX idx_forum_bans_user ON public.forum_bans(user_id);
CREATE INDEX idx_forum_attachments_thread ON public.forum_attachments(thread_id);
CREATE INDEX idx_forum_attachments_post ON public.forum_attachments(post_id);

-- ==================
-- 3. TRIGGERS
-- ==================

-- 3a. Auto-update last_post_at on forum_threads when a new post is inserted
CREATE OR REPLACE FUNCTION public.forum_update_thread_last_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.forum_threads
  SET last_post_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_forum_post_update_thread
  AFTER INSERT ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_update_thread_last_post();

-- 3b. Auto-update updated_at on forum_threads
CREATE OR REPLACE FUNCTION public.forum_threads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_forum_threads_updated_at
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_threads_updated_at();

-- 3c. Auto-update updated_at on forum_posts
CREATE OR REPLACE FUNCTION public.forum_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.forum_posts_updated_at();

-- ==================
-- 4. HELPER FUNCTIONS (for RLS)
-- ==================

-- Check if user is banned from forum
CREATE OR REPLACE FUNCTION public.forum_is_banned(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forum_bans
    WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Check if user is admin (reuses existing is_admin if available, fallback)
CREATE OR REPLACE FUNCTION public.forum_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND is_active = true
  );
$$;

-- Get profile_id for current auth user
CREATE OR REPLACE FUNCTION public.forum_get_my_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Check board access for current user
CREATE OR REPLACE FUNCTION public.forum_can_access_board(p_board_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board RECORD;
  v_profile RECORD;
BEGIN
  SELECT visibility, allowed_roles, is_active
  INTO v_board
  FROM public.forum_boards
  WHERE id = p_board_id;

  IF v_board IS NULL OR NOT v_board.is_active THEN
    RETURN false;
  END IF;

  -- PUBLIC boards: everyone can access
  IF v_board.visibility = 'PUBLIC' THEN
    RETURN true;
  END IF;

  -- ADMIN_ONLY: only admins
  IF v_board.visibility = 'ADMIN_ONLY' THEN
    RETURN public.forum_is_admin();
  END IF;

  -- Need profile for other checks
  SELECT id, role, status INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF v_profile IS NULL THEN
    RETURN false;
  END IF;

  -- VERIFIED_ONLY: approved users
  IF v_board.visibility = 'VERIFIED_ONLY' THEN
    RETURN v_profile.status = 'APPROVED';
  END IF;

  -- AFFILIATES_ONLY: affiliated drivers
  IF v_board.visibility = 'AFFILIATES_ONLY' THEN
    RETURN v_profile.role IN ('MOTORISTA_AFILIADO', 'TRANSPORTADORA');
  END IF;

  -- allowed_roles filter
  IF v_board.allowed_roles IS NOT NULL AND array_length(v_board.allowed_roles, 1) > 0 THEN
    RETURN v_profile.role::text = ANY(v_board.allowed_roles);
  END IF;

  RETURN true;
END;
$$;

-- ==================
-- 5. RLS - Enable on all tables
-- ==================

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_thread_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_moderation_logs ENABLE ROW LEVEL SECURITY;

-- ==================
-- 5a. forum_categories - read-only for all authenticated, admin manages
-- ==================

CREATE POLICY "forum_categories_select" ON public.forum_categories
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "forum_categories_admin_select" ON public.forum_categories
  FOR SELECT TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_categories_admin_insert" ON public.forum_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.forum_is_admin());

CREATE POLICY "forum_categories_admin_update" ON public.forum_categories
  FOR UPDATE TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_categories_admin_delete" ON public.forum_categories
  FOR DELETE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5b. forum_boards - read respects visibility, admin manages
-- ==================

CREATE POLICY "forum_boards_select" ON public.forum_boards
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND public.forum_can_access_board(id)
  );

CREATE POLICY "forum_boards_admin_select" ON public.forum_boards
  FOR SELECT TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_boards_admin_insert" ON public.forum_boards
  FOR INSERT TO authenticated
  WITH CHECK (public.forum_is_admin());

CREATE POLICY "forum_boards_admin_update" ON public.forum_boards
  FOR UPDATE TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_boards_admin_delete" ON public.forum_boards
  FOR DELETE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5c. forum_threads - read if board accessible, write if not banned
-- ==================

CREATE POLICY "forum_threads_select" ON public.forum_threads
  FOR SELECT TO authenticated
  USING (
    public.forum_can_access_board(board_id)
  );

CREATE POLICY "forum_threads_insert" ON public.forum_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = public.forum_get_my_profile_id()
    AND NOT public.forum_is_banned(public.forum_get_my_profile_id())
    AND public.forum_can_access_board(board_id)
  );

-- Author can update within 15 min, admin always
CREATE POLICY "forum_threads_update_author" ON public.forum_threads
  FOR UPDATE TO authenticated
  USING (
    (
      author_user_id = public.forum_get_my_profile_id()
      AND created_at > now() - interval '15 minutes'
    )
    OR public.forum_is_admin()
  );

-- No hard delete for threads (soft delete via status='ARCHIVED')
-- Admin can delete
CREATE POLICY "forum_threads_delete_admin" ON public.forum_threads
  FOR DELETE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5d. forum_posts - read if thread's board accessible, write if not banned
-- ==================

CREATE POLICY "forum_posts_select" ON public.forum_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id = forum_posts.thread_id
      AND public.forum_can_access_board(t.board_id)
    )
  );

CREATE POLICY "forum_posts_insert" ON public.forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = public.forum_get_my_profile_id()
    AND NOT public.forum_is_banned(public.forum_get_my_profile_id())
    AND EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id = forum_posts.thread_id
      AND t.is_locked = false
      AND t.status = 'OPEN'
      AND public.forum_can_access_board(t.board_id)
    )
  );

-- Author can edit within 15 min (soft delete only), admin always
CREATE POLICY "forum_posts_update" ON public.forum_posts
  FOR UPDATE TO authenticated
  USING (
    (
      author_user_id = public.forum_get_my_profile_id()
      AND created_at > now() - interval '15 minutes'
    )
    OR public.forum_is_admin()
  );

-- No hard delete for posts - admin only
CREATE POLICY "forum_posts_delete_admin" ON public.forum_posts
  FOR DELETE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5e. forum_attachments
-- ==================

CREATE POLICY "forum_attachments_select" ON public.forum_attachments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "forum_attachments_insert" ON public.forum_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_user_id = public.forum_get_my_profile_id()
    AND NOT public.forum_is_banned(public.forum_get_my_profile_id())
  );

CREATE POLICY "forum_attachments_delete_admin" ON public.forum_attachments
  FOR DELETE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5f. forum_thread_views - user manages own views
-- ==================

CREATE POLICY "forum_thread_views_select" ON public.forum_thread_views
  FOR SELECT TO authenticated
  USING (user_id = public.forum_get_my_profile_id());

CREATE POLICY "forum_thread_views_insert" ON public.forum_thread_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.forum_get_my_profile_id());

CREATE POLICY "forum_thread_views_update" ON public.forum_thread_views
  FOR UPDATE TO authenticated
  USING (user_id = public.forum_get_my_profile_id());

-- ==================
-- 5g. forum_reports - user can create, admin manages
-- ==================

CREATE POLICY "forum_reports_insert" ON public.forum_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = public.forum_get_my_profile_id()
    AND NOT public.forum_is_banned(public.forum_get_my_profile_id())
  );

CREATE POLICY "forum_reports_select_own" ON public.forum_reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = public.forum_get_my_profile_id());

CREATE POLICY "forum_reports_select_admin" ON public.forum_reports
  FOR SELECT TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_reports_update_admin" ON public.forum_reports
  FOR UPDATE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5h. forum_bans - admin only
-- ==================

CREATE POLICY "forum_bans_select_admin" ON public.forum_bans
  FOR SELECT TO authenticated
  USING (public.forum_is_admin());

-- Allow users to check if they are banned (needed by forum_is_banned function uses SECURITY DEFINER)
CREATE POLICY "forum_bans_select_own" ON public.forum_bans
  FOR SELECT TO authenticated
  USING (user_id = public.forum_get_my_profile_id());

CREATE POLICY "forum_bans_insert_admin" ON public.forum_bans
  FOR INSERT TO authenticated
  WITH CHECK (public.forum_is_admin());

CREATE POLICY "forum_bans_update_admin" ON public.forum_bans
  FOR UPDATE TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_bans_delete_admin" ON public.forum_bans
  FOR DELETE TO authenticated
  USING (public.forum_is_admin());

-- ==================
-- 5i. forum_moderation_logs - admin only
-- ==================

CREATE POLICY "forum_moderation_logs_select_admin" ON public.forum_moderation_logs
  FOR SELECT TO authenticated
  USING (public.forum_is_admin());

CREATE POLICY "forum_moderation_logs_insert_admin" ON public.forum_moderation_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.forum_is_admin());

-- ==================
-- 6. STORAGE BUCKET
-- ==================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forum-attachments',
  'forum-attachments',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "forum_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'forum-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: authenticated users can read forum attachments
CREATE POLICY "forum_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'forum-attachments');

-- Storage RLS: users can delete own files, admin can delete any
CREATE POLICY "forum_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'forum-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.forum_is_admin()
    )
  );
