
-- Add new columns to system_announcements for advanced features
ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS send_push boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Update existing active announcements to 'published' status
UPDATE public.system_announcements SET status = 'published' WHERE is_active = true AND archived = false;
UPDATE public.system_announcements SET status = 'archived' WHERE archived = true;

-- Create announcement_versions table for version history
CREATE TABLE IF NOT EXISTS public.announcement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  subtitle text,
  message text NOT NULL,
  type text,
  category text,
  priority integer,
  target_audience text[],
  cta_text text,
  cta_url text,
  banner_url text,
  metadata jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_summary text
);

ALTER TABLE public.announcement_versions ENABLE ROW LEVEL SECURITY;

-- Only admins (via service_role or admin check) can read versions
CREATE POLICY "Admins can read announcement versions"
  ON public.announcement_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Deny anon access to announcement versions"
  ON public.announcement_versions FOR SELECT
  TO anon
  USING (false);

-- Function to auto-save version on update
CREATE OR REPLACE FUNCTION public.save_announcement_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.announcement_versions (
    announcement_id, version, title, subtitle, message, type, category,
    priority, target_audience, cta_text, cta_url, banner_url, metadata,
    changed_by, change_summary
  ) VALUES (
    OLD.id, OLD.version, OLD.title, OLD.subtitle, OLD.message, OLD.type,
    OLD.category, OLD.priority, OLD.target_audience, OLD.cta_text, OLD.cta_url,
    OLD.banner_url, OLD.metadata, NEW.updated_by,
    CASE
      WHEN OLD.title != NEW.title THEN 'Título alterado'
      WHEN OLD.message != NEW.message THEN 'Conteúdo alterado'
      WHEN OLD.is_active != NEW.is_active THEN 'Status alterado'
      WHEN OLD.archived != NEW.archived THEN 'Arquivamento alterado'
      ELSE 'Atualização geral'
    END
  );
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_save_announcement_version ON public.system_announcements;
CREATE TRIGGER trg_save_announcement_version
  BEFORE UPDATE ON public.system_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.save_announcement_version();
