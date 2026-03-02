
-- Allow any authenticated user to create categories
CREATE POLICY "forum_categories_authenticated_insert"
  ON public.forum_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow any authenticated user to create boards
CREATE POLICY "forum_boards_authenticated_insert"
  ON public.forum_boards
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
