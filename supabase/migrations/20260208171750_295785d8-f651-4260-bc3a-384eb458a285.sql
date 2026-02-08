
-- Tabela para gerenciar imagens de fundo dinâmicas dos painéis e landing page
CREATE TABLE public.hero_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.hero_backgrounds ENABLE ROW LEVEL SECURITY;

-- Leitura pública (todos precisam ver a imagem ativa - inclusive visitantes não logados na landing page)
CREATE POLICY "hero_backgrounds_select_public"
  ON public.hero_backgrounds
  FOR SELECT
  USING (true);

-- Apenas admins podem inserir/atualizar/deletar (usando função is_admin existente)
CREATE POLICY "hero_backgrounds_insert_admin"
  ON public.hero_backgrounds
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "hero_backgrounds_update_admin"
  ON public.hero_backgrounds
  FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "hero_backgrounds_delete_admin"
  ON public.hero_backgrounds
  FOR DELETE
  USING (public.is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_hero_backgrounds_updated_at
  BEFORE UPDATE ON public.hero_backgrounds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para garantir que apenas uma imagem esteja ativa por vez
CREATE OR REPLACE FUNCTION public.ensure_single_active_hero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.hero_backgrounds
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_active_hero_trigger
  BEFORE INSERT OR UPDATE OF is_active ON public.hero_backgrounds
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.ensure_single_active_hero();

-- Inserir registro padrão com a imagem atual
INSERT INTO public.hero_backgrounds (title, image_url, mobile_image_url, is_active, description)
VALUES (
  'Padrão - Caminhão Noturno',
  '/hero-truck-night-moon.webp',
  '/hero-truck-night-moon-mobile.webp',
  true,
  'Imagem padrão do sistema'
);
