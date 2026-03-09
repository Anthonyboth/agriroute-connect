
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.force_password_change IS 'When true, user must change password on next login (set by admin password reset)';
