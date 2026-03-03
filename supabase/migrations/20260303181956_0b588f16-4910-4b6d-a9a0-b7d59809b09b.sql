-- Fix forum_board_rules: restrict to admin only
DROP POLICY IF EXISTS "forum_board_rules_delete_auth" ON public.forum_board_rules;
DROP POLICY IF EXISTS "forum_board_rules_insert_auth" ON public.forum_board_rules;
DROP POLICY IF EXISTS "forum_board_rules_update_auth" ON public.forum_board_rules;

CREATE POLICY "forum_board_rules_insert_admin"
ON public.forum_board_rules FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "forum_board_rules_update_admin"
ON public.forum_board_rules FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "forum_board_rules_delete_admin"
ON public.forum_board_rules FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix forum_boards: restrict INSERT to admin only
DROP POLICY IF EXISTS "forum_boards_authenticated_insert" ON public.forum_boards;

CREATE POLICY "forum_boards_insert_admin"
ON public.forum_boards FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix forum_categories: restrict INSERT to admin only
DROP POLICY IF EXISTS "forum_categories_authenticated_insert" ON public.forum_categories;

CREATE POLICY "forum_categories_insert_admin"
ON public.forum_categories FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));