-- Criar tabela de solicitações de saque para prestadores de serviços
CREATE TABLE public.service_provider_payout_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid NOT NULL,
  amount numeric NOT NULL,
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text,
  processed_at timestamp with time zone,
  processed_by uuid,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.service_provider_payout_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Prestadores podem criar suas próprias solicitações de saque"
ON public.service_provider_payout_requests
FOR INSERT
WITH CHECK (provider_id IN (
  SELECT profiles.id
  FROM profiles
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'PRESTADOR_SERVICOS'::user_role
));

CREATE POLICY "Prestadores podem ver suas próprias solicitações"
ON public.service_provider_payout_requests
FOR SELECT
USING ((provider_id IN (
  SELECT profiles.id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
)) OR is_admin());

CREATE POLICY "Admins podem atualizar solicitações"
ON public.service_provider_payout_requests
FOR UPDATE
USING (is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_service_provider_payout_requests_updated_at
BEFORE UPDATE ON public.service_provider_payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela de pagamentos para prestadores de serviços (similar aos driver_payouts)
CREATE TABLE public.service_provider_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid NOT NULL,
  service_request_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text,
  processed_at timestamp with time zone,
  stripe_transfer_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.service_provider_payouts ENABLE ROW LEVEL SECURITY;

-- Políticas para service_provider_payouts
CREATE POLICY "Prestadores podem ver seus próprios pagamentos"
ON public.service_provider_payouts
FOR SELECT
USING (provider_id IN (
  SELECT profiles.id
  FROM profiles
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Admins podem gerenciar todos os pagamentos"
ON public.service_provider_payouts
FOR ALL
USING (is_admin());

-- Trigger para updated_at
CREATE TRIGGER update_service_provider_payouts_updated_at
BEFORE UPDATE ON public.service_provider_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();