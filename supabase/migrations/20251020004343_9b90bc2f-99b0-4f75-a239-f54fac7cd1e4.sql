-- Add RLS policies for ratings table
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Users can view ratings where they are the rater or rated user
CREATE POLICY "Users can view their own ratings"
  ON public.ratings
  FOR SELECT
  USING (
    rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR rated_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM freight_assignments fa
      WHERE fa.freight_id = ratings.freight_id
        AND fa.driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Users can insert ratings for freights they are part of
CREATE POLICY "Users can create ratings for their freights"
  ON public.ratings
  FOR INSERT
  WITH CHECK (
    rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND (
      -- Rater is producer or driver of the freight
      freight_id IN (
        SELECT id FROM freights
        WHERE producer_id = rater_user_id OR driver_id = rater_user_id
      )
      OR
      -- Rater has assignment on the freight
      freight_id IN (
        SELECT freight_id FROM freight_assignments
        WHERE driver_id = rater_user_id
      )
    )
  );

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
  ON public.ratings
  FOR UPDATE
  USING (rater_user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
  ON public.ratings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );