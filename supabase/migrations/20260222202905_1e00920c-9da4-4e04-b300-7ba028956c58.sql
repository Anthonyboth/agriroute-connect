
-- =====================================================
-- ADMIN PANEL MVP - Allowlist + Registration Actions + Settings
-- =====================================================

-- 1) admin_users allowlist table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'reviewer' CHECK (role IN ('superadmin', 'reviewer', 'support', 'finance', 'ops')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(is_active);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only admins in the allowlist can read admin_users
CREATE POLICY "admin_users_select_by_admin" ON public.admin_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Only superadmins can update admin_users
CREATE POLICY "admin_users_update_by_superadmin" ON public.admin_users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true AND au.role = 'superadmin'
    )
  );

-- No public INSERT/DELETE - admin creation only via direct DB access

-- 2) admin_registration_actions - audit trail for admin actions on registrations
CREATE TABLE IF NOT EXISTS public.admin_registration_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN ('APPROVE', 'REJECT', 'NEEDS_FIX', 'NOTE')),
  reason TEXT,
  reason_category TEXT,
  internal_notes TEXT,
  previous_status TEXT,
  new_status TEXT,
  message_to_user TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_reg_actions_profile ON public.admin_registration_actions(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_reg_actions_admin ON public.admin_registration_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_reg_actions_created ON public.admin_registration_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_reg_actions_action ON public.admin_registration_actions(action);

ALTER TABLE public.admin_registration_actions ENABLE ROW LEVEL SECURITY;

-- Only allowlisted admins can read/insert actions
CREATE POLICY "admin_reg_actions_select" ON public.admin_registration_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

CREATE POLICY "admin_reg_actions_insert" ON public.admin_registration_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
      AND au.id = admin_user_id
    )
  );

-- 3) admin_settings - configurable settings (rejection categories, required docs, templates)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read settings
CREATE POLICY "admin_settings_select" ON public.admin_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );

-- Only superadmins can update settings
CREATE POLICY "admin_settings_update" ON public.admin_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true AND au.role = 'superadmin'
    )
  );

CREATE POLICY "admin_settings_insert" ON public.admin_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid() AND au.is_active = true AND au.role = 'superadmin'
    )
  );

-- 4) Add NEEDS_FIX status to profiles if not exists, and admin_message field
DO $$
BEGIN
  -- Add admin_message column for displaying messages to users (NEEDS_FIX instructions, rejection reason)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'admin_message') THEN
    ALTER TABLE public.profiles ADD COLUMN admin_message TEXT;
  END IF;
  
  -- Add admin_message_category for categorizing the message
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'admin_message_category') THEN
    ALTER TABLE public.profiles ADD COLUMN admin_message_category TEXT;
  END IF;
END $$;

-- 5) Seed default settings
INSERT INTO public.admin_settings (setting_key, setting_value, description)
VALUES 
  ('rejection_categories', '["Documento ilegível", "Dados inconsistentes", "Selfie não confere", "CNH inválida/vencida", "CNPJ irregular", "Endereço não confere", "Documentos incompletos", "Suspeita de fraude", "Outro"]'::jsonb, 'Categorias de reprovação de cadastro'),
  ('required_documents', '{"MOTORISTA": ["selfie", "document_photo", "cnh", "address_proof"], "PRESTADOR_SERVICOS": ["selfie", "document_photo"], "PRODUTOR": ["selfie", "document_photo"]}'::jsonb, 'Documentos obrigatórios por tipo de perfil'),
  ('needs_fix_templates', '["Por favor, envie uma foto mais nítida do seu documento.", "A selfie enviada não confere com o documento. Envie uma nova.", "Seu documento está ilegível. Tire uma nova foto com boa iluminação.", "Sua CNH está vencida. Envie uma CNH válida.", "Precisamos do comprovante de endereço atualizado."]'::jsonb, 'Templates de mensagens para solicitar correção'),
  ('rejection_templates', '["Infelizmente seu cadastro foi reprovado por inconsistência nos documentos.", "Cadastro reprovado: suspeita de fraude documental.", "Cadastro reprovado: documentação incompleta após prazo de correção."]'::jsonb, 'Templates de mensagens de reprovação')
ON CONFLICT (setting_key) DO NOTHING;

-- 6) Function to check if current user is an allowlisted admin
CREATE OR REPLACE FUNCTION public.is_allowlisted_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- 7) Function to get admin role
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- 8) Update timestamp trigger for admin tables
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
