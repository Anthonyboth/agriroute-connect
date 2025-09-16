-- Corrigir estrutura da tabela subscribers para alinhar com o webhook
ALTER TABLE public.subscribers RENAME COLUMN email TO user_email;
ALTER TABLE public.subscribers RENAME COLUMN subscription_end TO subscription_end_date;

-- Adicionar coluna para subscription_id que falta
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS subscription_id text;
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS tier text DEFAULT 'FREE';

-- Criar tabela para transferências/repasses
CREATE TABLE public.driver_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

-- Habilitar RLS
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Drivers can view their own payouts"
ON public.driver_payouts
FOR SELECT
USING (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all payouts"
ON public.driver_payouts
FOR ALL
USING (is_admin());