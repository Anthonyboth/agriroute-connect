
-- Add RLS policies for dynamic_credit_limits table
CREATE POLICY "Users can view own dynamic credit"
  ON public.dynamic_credit_limits
  FOR SELECT
  TO authenticated
  USING (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own dynamic credit"
  ON public.dynamic_credit_limits
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own dynamic credit"
  ON public.dynamic_credit_limits
  FOR UPDATE
  TO authenticated
  USING (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
