-- Criar tabela de convites de motoristas
CREATE TABLE IF NOT EXISTS public.convites_motoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transportadora_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMP WITH TIME ZONE NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  usado_por UUID REFERENCES public.profiles(id),
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usado_em TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
CREATE INDEX idx_convites_token ON public.convites_motoristas(token) WHERE NOT usado;
CREATE INDEX idx_convites_expiracao ON public.convites_motoristas(expira_em) WHERE NOT usado;
CREATE INDEX idx_convites_transportadora ON public.convites_motoristas(transportadora_id);

-- Habilitar RLS
ALTER TABLE public.convites_motoristas ENABLE ROW LEVEL SECURITY;

-- Transportadoras podem criar convites
CREATE POLICY "Transportadoras podem criar convites"
  ON public.convites_motoristas FOR INSERT
  WITH CHECK (
    transportadora_id IN (
      SELECT tc.profile_id 
      FROM transport_companies tc 
      WHERE tc.profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Transportadoras veem seus próprios convites
CREATE POLICY "Transportadoras veem seus próprios convites"
  ON public.convites_motoristas FOR SELECT
  USING (
    transportadora_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ) OR is_admin()
  );

-- Sistema pode validar tokens publicamente (sem autenticação)
CREATE POLICY "Sistema pode validar tokens publicamente"
  ON public.convites_motoristas FOR SELECT
  USING (NOT usado AND expira_em > now());