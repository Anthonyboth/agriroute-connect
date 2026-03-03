
-- Add new columns to system_announcements for professional notice board
ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS target_audience text[] DEFAULT ARRAY['todos']::text[],
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);

-- Update category check: allow new categories
COMMENT ON COLUMN public.system_announcements.category IS 'informativo, alerta, promocao, atualizacao, financeiro, comunicado, manutencao';
COMMENT ON COLUMN public.system_announcements.target_audience IS 'Array: todos, motoristas, produtores, transportadoras, prestadores';
COMMENT ON COLUMN public.system_announcements.priority IS 'Priority 1-100, higher = more important';

-- Create announcement_audit_log table
CREATE TABLE IF NOT EXISTS public.announcement_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  action text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  old_values jsonb,
  new_values jsonb
);

ALTER TABLE public.announcement_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (via service_role or admin check)
CREATE POLICY "Admin can read announcement audit logs"
  ON public.announcement_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Log insert policy for authenticated admin users
CREATE POLICY "Admin can insert announcement audit logs"
  ON public.announcement_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_announcement_view(p_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE system_announcements
  SET view_count = COALESCE(view_count, 0) + 1,
      last_viewed_at = now()
  WHERE id = p_announcement_id;
END;
$$;

-- Function to increment click count
CREATE OR REPLACE FUNCTION public.increment_announcement_click(p_announcement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE system_announcements
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = p_announcement_id;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.increment_announcement_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_announcement_click(uuid) TO authenticated;
