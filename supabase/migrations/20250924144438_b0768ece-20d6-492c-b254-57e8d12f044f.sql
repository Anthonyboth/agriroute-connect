-- Adicionar trigger na tabela freight_payments para atualizar saldos
CREATE TRIGGER update_balance_on_payment_confirmation
  AFTER UPDATE ON public.freight_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_provider_balance_from_stripe_payment();

-- Função para processar saques de prestadores
CREATE OR REPLACE FUNCTION public.process_payout_request(
  provider_id_param UUID,
  amount_param NUMERIC,
  pix_key_param TEXT,
  description_param TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  current_balance NUMERIC := 0;
  payout_record RECORD;
BEGIN
  -- Verificar saldo disponível
  SELECT available_balance INTO current_balance
  FROM public.service_provider_balances
  WHERE provider_id = provider_id_param;

  -- Se não existe registro de saldo, criar com saldo zero
  IF current_balance IS NULL THEN
    INSERT INTO public.service_provider_balances (
      provider_id,
      available_balance,
      total_earned
    ) VALUES (
      provider_id_param,
      0,
      0
    );
    current_balance := 0;
  END IF;

  -- Verificar se tem saldo suficiente
  IF current_balance < amount_param THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente',
      'available_balance', current_balance
    );
  END IF;

  -- Criar solicitação de saque
  INSERT INTO public.balance_transactions (
    provider_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    reference_type,
    status,
    description,
    metadata
  ) VALUES (
    provider_id_param,
    'PAYOUT',
    amount_param,
    current_balance,
    current_balance - amount_param,
    'PAYOUT_REQUEST',
    'PENDING',
    COALESCE(description_param, 'Solicitação de saque via PIX'),
    jsonb_build_object(
      'pix_key', pix_key_param,
      'requested_at', now()
    )
  ) RETURNING * INTO payout_record;

  -- Atualizar saldo (deduzir o valor solicitado)
  UPDATE public.service_provider_balances
  SET 
    available_balance = available_balance - amount_param,
    updated_at = now()
  WHERE provider_id = provider_id_param;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', payout_record.id,
    'new_balance', current_balance - amount_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para obter saldo de um prestador
CREATE OR REPLACE FUNCTION public.get_provider_balance(provider_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  balance_record RECORD;
BEGIN
  SELECT 
    available_balance,
    pending_balance,
    total_earned,
    last_payout_at,
    updated_at
  INTO balance_record
  FROM public.service_provider_balances
  WHERE provider_id = provider_id_param;

  -- Se não existe registro, retornar saldos zerados
  IF balance_record IS NULL THEN
    RETURN jsonb_build_object(
      'available_balance', 0,
      'pending_balance', 0,
      'total_earned', 0,
      'last_payout_at', null,
      'updated_at', null
    );
  END IF;

  RETURN row_to_json(balance_record)::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;