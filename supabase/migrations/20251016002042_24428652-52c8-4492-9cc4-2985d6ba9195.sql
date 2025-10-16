-- Criar tabela de anúncios do sistema
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, error
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de dismissals de anúncios por usuário
CREATE TABLE IF NOT EXISTS public.user_announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.system_announcements(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, announcement_id)
);

-- Enable RLS
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- RLS Policies para system_announcements
CREATE POLICY "Todos podem ver anúncios ativos"
  ON public.system_announcements
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins podem gerenciar anúncios"
  ON public.system_announcements
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies para user_announcement_dismissals
CREATE POLICY "Usuários veem seus próprios dismissals"
  ON public.user_announcement_dismissals
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuários gerenciam seus próprios dismissals"
  ON public.user_announcement_dismissals
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserir anúncio inicial sobre período de testes
INSERT INTO public.system_announcements (title, message, type, priority)
VALUES (
  '🔷 Período de Testes - Plataforma Gratuita',
  E'A plataforma está disponível gratuitamente por um período indeterminado para que você possa testar e verificar seu valor.\n\nQuando for o momento certo, implementaremos uma cobrança mensal ou percentual pelo uso da plataforma.\n\n✨ Aproveite o período de testes e conheça todos os recursos!\n\n⚠️ **Importante:** Durante o período de testes, transações financeiras não estão habilitadas dentro da plataforma. Os acordos de pagamento devem ser feitos externamente.',
  'info',
  100
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_system_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_system_announcements_updated_at_trigger
  BEFORE UPDATE ON public.system_announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_system_announcements_updated_at();