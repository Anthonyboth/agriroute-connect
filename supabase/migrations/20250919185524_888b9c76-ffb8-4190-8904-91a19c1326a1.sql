-- Criar tabela para solicitações de saque dos motoristas
CREATE TABLE public.driver_payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  pix_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
  rejection_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.driver_payout_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Motoristas podem criar suas próprias solicitações de saque" 
ON public.driver_payout_requests 
FOR INSERT 
WITH CHECK (
  driver_id IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'MOTORISTA'
  )
);

CREATE POLICY "Motoristas podem ver suas próprias solicitações" 
ON public.driver_payout_requests 
FOR SELECT 
USING (
  driver_id IN (
    SELECT id FROM public.profiles 
    WHERE user_id = auth.uid()
  ) OR is_admin()
);

CREATE POLICY "Admins podem atualizar solicitações" 
ON public.driver_payout_requests 
FOR UPDATE 
USING (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_driver_payout_requests_updated_at
BEFORE UPDATE ON public.driver_payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();