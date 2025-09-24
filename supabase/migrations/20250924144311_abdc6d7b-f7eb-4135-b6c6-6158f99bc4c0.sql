-- Tabela para controlar saldos de motoristas e prestadores de serviços
CREATE TABLE public.service_provider_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  pending_balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  last_payout_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(provider_id)
);

-- Habilitar RLS
ALTER TABLE public.service_provider_balances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Prestadores podem ver seu próprio saldo"
  ON public.service_provider_balances FOR SELECT
  USING (provider_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Sistema pode gerenciar saldos"
  ON public.service_provider_balances FOR ALL
  USING (true)
  WITH CHECK (true);

-- Tabela para histórico de transações de saldo
CREATE TABLE public.balance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'PAYOUT', 'PAYMENT_CONFIRMED')),
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL DEFAULT 0,
  balance_after NUMERIC NOT NULL DEFAULT 0,
  reference_type TEXT CHECK (reference_type IN ('FREIGHT_PAYMENT', 'SERVICE_REQUEST_PAYMENT', 'PAYOUT_REQUEST', 'ADJUSTMENT')),
  reference_id UUID,
  stripe_payment_intent_id TEXT,
  stripe_payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de transações
ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para transações
CREATE POLICY "Prestadores podem ver suas próprias transações"
  ON public.balance_transactions FOR SELECT
  USING (provider_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins podem ver todas as transações"
  ON public.balance_transactions FOR SELECT
  USING (is_admin());

CREATE POLICY "Sistema pode gerenciar transações"
  ON public.balance_transactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_service_provider_balances_updated_at
  BEFORE UPDATE ON public.service_provider_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_balance_transactions_updated_at
  BEFORE UPDATE ON public.balance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar saldo após confirmação de pagamento do Stripe
CREATE OR REPLACE FUNCTION public.update_provider_balance_from_stripe_payment()
RETURNS TRIGGER AS $$
DECLARE
  provider_profile_id UUID;
  current_balance NUMERIC := 0;
  commission_amount NUMERIC := 0;
  net_amount NUMERIC := 0;
BEGIN
  -- Só processar se o status mudou para COMPLETED e há stripe_payment_intent_id
  IF NEW.status = 'COMPLETED' AND OLD.status = 'PENDING' AND NEW.stripe_payment_intent_id IS NOT NULL THEN
    
    -- Determinar o prestador baseado no tipo de pagamento
    IF NEW.payment_type = 'FREIGHT_PAYMENT' THEN
      -- Para pagamentos de frete, o receptor é o motorista
      SELECT f.driver_id INTO provider_profile_id
      FROM freights f
      WHERE f.id = NEW.freight_id;
      
      -- Calcular comissão da plataforma (2% padrão)
      commission_amount := NEW.amount * 0.02;
      net_amount := NEW.amount - commission_amount;
      
    ELSIF NEW.payment_type = 'SERVICE_PAYMENT' THEN
      -- Para pagamentos de serviço, usar o receiver_id diretamente
      provider_profile_id := NEW.receiver_id;
      
      -- Calcular comissão da plataforma (2% padrão)  
      commission_amount := NEW.amount * 0.02;
      net_amount := NEW.amount - commission_amount;
    END IF;

    -- Se encontrou um prestador, atualizar seu saldo
    IF provider_profile_id IS NOT NULL THEN
      
      -- Inserir ou atualizar saldo do prestador
      INSERT INTO public.service_provider_balances (
        provider_id,
        available_balance,
        total_earned,
        updated_at
      ) VALUES (
        provider_profile_id,
        net_amount,
        net_amount,
        now()
      )
      ON CONFLICT (provider_id) DO UPDATE SET
        available_balance = service_provider_balances.available_balance + net_amount,
        total_earned = service_provider_balances.total_earned + net_amount,
        updated_at = now();

      -- Obter saldo atual para o histórico
      SELECT available_balance - net_amount INTO current_balance
      FROM public.service_provider_balances
      WHERE provider_id = provider_profile_id;

      -- Registrar transação no histórico
      INSERT INTO public.balance_transactions (
        provider_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        stripe_payment_intent_id,
        status,
        description,
        metadata
      ) VALUES (
        provider_profile_id,
        'CREDIT',
        net_amount,
        current_balance,
        current_balance + net_amount,
        CASE 
          WHEN NEW.payment_type = 'FREIGHT_PAYMENT' THEN 'FREIGHT_PAYMENT'
          ELSE 'SERVICE_REQUEST_PAYMENT'
        END,
        NEW.freight_id,
        NEW.stripe_payment_intent_id,
        'COMPLETED',
        'Pagamento confirmado via Stripe - Comissão: R$ ' || commission_amount::TEXT,
        jsonb_build_object(
          'gross_amount', NEW.amount,
          'commission_amount', commission_amount,
          'net_amount', net_amount,
          'payment_type', NEW.payment_type
        )
      );
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;