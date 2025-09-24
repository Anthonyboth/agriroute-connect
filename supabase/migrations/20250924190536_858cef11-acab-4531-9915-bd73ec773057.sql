-- Remover função existente
DROP FUNCTION IF EXISTS public.get_provider_balance(uuid);

-- Criar tabela para pagamentos de serviços
CREATE TABLE public.service_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_request_id uuid NOT NULL,
  client_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  amount numeric NOT NULL,
  platform_fee numeric DEFAULT 0,
  net_amount numeric GENERATED ALWAYS AS (amount - COALESCE(platform_fee, 0)) STORED,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  payment_method text NOT NULL DEFAULT 'STRIPE_CHECKOUT',
  stripe_session_id text,
  stripe_payment_intent_id text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para service_payments
CREATE POLICY "Clientes podem ver seus pagamentos" 
ON public.service_payments 
FOR SELECT 
USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Prestadores podem ver pagamentos recebidos" 
ON public.service_payments 
FOR SELECT 
USING (provider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sistema pode gerenciar pagamentos" 
ON public.service_payments 
FOR ALL 
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_service_payments_updated_at
BEFORE UPDATE ON public.service_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para processar saldo do prestador quando pagamento é completado
CREATE OR REPLACE FUNCTION public.process_service_payment_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  commission_rate NUMERIC := 2.0; -- 2% de comissão da plataforma
  provider_amount NUMERIC;
BEGIN
  -- Só processar quando status muda para COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    -- Calcular valor para o prestador (98% do valor total)
    provider_amount := NEW.amount * (100 - commission_rate) / 100;
    
    -- Atualizar platform_fee se não foi definido
    IF NEW.platform_fee IS NULL OR NEW.platform_fee = 0 THEN
      NEW.platform_fee := NEW.amount * commission_rate / 100;
    END IF;
    
    -- Inserir transação de saldo para o prestador
    INSERT INTO public.balance_transactions (
      provider_id,
      transaction_type,
      amount,
      reference_type,
      reference_id,
      description,
      status,
      stripe_payment_intent_id,
      metadata
    ) VALUES (
      NEW.provider_id,
      'CREDIT',
      provider_amount,
      'SERVICE_PAYMENT',
      NEW.id,
      'Pagamento recebido por serviço prestado',
      'COMPLETED',
      NEW.stripe_payment_intent_id,
      jsonb_build_object(
        'service_request_id', NEW.service_request_id,
        'gross_amount', NEW.amount,
        'commission_rate', commission_rate,
        'platform_fee', NEW.platform_fee
      )
    );
    
    -- Log da transação
    RAISE NOTICE 'Balance updated for provider % - Service payment: R$ %', NEW.provider_id, provider_amount;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para processar saldo quando pagamento é completado
CREATE TRIGGER process_service_payment_balance_trigger
AFTER UPDATE ON public.service_payments
FOR EACH ROW
EXECUTE FUNCTION public.process_service_payment_balance();