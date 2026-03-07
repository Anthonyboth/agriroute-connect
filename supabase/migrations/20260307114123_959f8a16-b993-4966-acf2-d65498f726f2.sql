
-- ============================================================
-- 1. CREATE PAYMENT ORDER (when producer pays freight)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_payment_order(
  p_freight_id UUID,
  p_payer_profile_id UUID,
  p_operation_owner_type TEXT,
  p_financial_owner_id UUID,
  p_executor_id UUID,
  p_gross_amount NUMERIC,
  p_platform_fee_pct NUMERIC DEFAULT 5.0
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_payer_wallet_id UUID;
  v_fee NUMERIC;
  v_available NUMERIC;
  v_balance_before NUMERIC;
BEGIN
  IF p_gross_amount <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero'; END IF;
  
  v_fee := ROUND(p_gross_amount * (p_platform_fee_pct / 100.0), 2);
  v_payer_wallet_id := public.ensure_wallet_exists(p_payer_profile_id);
  
  SELECT available_balance INTO v_available FROM public.wallets WHERE id = v_payer_wallet_id FOR UPDATE;
  IF v_available < p_gross_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Necessário: %', v_available, p_gross_amount;
  END IF;
  
  v_balance_before := v_available;
  
  -- Move to reserved
  UPDATE public.wallets SET available_balance = available_balance - p_gross_amount, reserved_balance = reserved_balance + p_gross_amount, updated_at = now() WHERE id = v_payer_wallet_id;
  
  -- Create order
  INSERT INTO public.payment_orders (freight_id, payer_profile_id, operation_owner_type, financial_owner_id, executor_id, gross_amount, platform_fee_amount, reserved_amount, status_operational, status_financial, contestation_window_ends_at)
  VALUES (p_freight_id, p_payer_profile_id, p_operation_owner_type, p_financial_owner_id, p_executor_id, p_gross_amount, v_fee, p_gross_amount, 'pending_collection', 'paid_reserved', now() + interval '48 hours')
  RETURNING id INTO v_order_id;
  
  -- Ledger
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_payer_wallet_id, 'escrow_reserve', -p_gross_amount, v_balance_before, v_balance_before - p_gross_amount, 'payment_order', v_order_id, format('Escrow frete - Order %s', v_order_id));
  
  -- Transaction record
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, metadata)
  VALUES (v_payer_wallet_id, 'escrow_reserve', p_gross_amount, 'reserved', 'Pagamento reservado para frete', p_payer_profile_id, jsonb_build_object('payment_order_id', v_order_id, 'freight_id', p_freight_id));
  
  -- Create receivable for financial owner
  PERFORM public.ensure_wallet_exists(p_financial_owner_id);
  INSERT INTO public.freight_receivables (freight_id, owner_wallet_id, owner_type, total_amount, status)
  VALUES (p_freight_id, (SELECT id FROM public.wallets WHERE profile_id = p_financial_owner_id LIMIT 1), CASE WHEN p_operation_owner_type = 'carrier' THEN 'carrier' ELSE 'driver' END, p_gross_amount - v_fee, 'reserved')
  ON CONFLICT (freight_id, owner_type) DO UPDATE SET total_amount = EXCLUDED.total_amount, status = 'reserved', updated_at = now();
  
  RETURN v_order_id;
END;
$$;

-- ============================================================
-- 2. SPLIT AND RELEASE (event-based liquidation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_freight_split(
  p_payment_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_owner_wallet_id UUID;
  v_payer_wallet_id UUID;
  v_owner_balance_before NUMERIC;
  v_adv_deduction NUMERIC := 0;
  v_cred_deduction NUMERIC := 0;
  v_net NUMERIC;
  v_owner_amount NUMERIC;
  v_advance RECORD;
  v_credit RECORD;
  v_payout_id UUID;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_payment_order_id FOR UPDATE;
  IF v_order IS NULL THEN RAISE EXCEPTION 'Payment order não encontrada'; END IF;
  IF v_order.status_financial != 'paid_reserved' THEN RAISE EXCEPTION 'Order não está em estado reservado: %', v_order.status_financial; END IF;
  
  -- Check operational conditions
  IF v_order.status_operational NOT IN ('delivered', 'completed') THEN
    RAISE EXCEPTION 'Entrega não confirmada. Status: %', v_order.status_operational;
  END IF;
  
  -- Check contestation window
  IF v_order.contestation_window_ends_at IS NOT NULL AND v_order.contestation_window_ends_at > now() THEN
    RAISE EXCEPTION 'Janela de contestação ainda aberta até %', v_order.contestation_window_ends_at;
  END IF;
  
  v_owner_wallet_id := (SELECT id FROM public.wallets WHERE profile_id = v_order.financial_owner_id LIMIT 1);
  v_payer_wallet_id := (SELECT id FROM public.wallets WHERE profile_id = v_order.payer_profile_id LIMIT 1);
  v_owner_amount := v_order.gross_amount - v_order.platform_fee_amount;
  
  -- Update order to processing
  UPDATE public.payment_orders SET status_financial = 'processing_split', updated_at = now() WHERE id = p_payment_order_id;
  
  -- PRIORITY 1: Deduct advances
  FOR v_advance IN SELECT ra.id, ra.net_amount FROM public.receivable_advances ra WHERE ra.wallet_id = v_owner_wallet_id AND ra.status = 'approved' ORDER BY ra.created_at ASC
  LOOP
    IF v_adv_deduction + v_advance.net_amount <= v_owner_amount THEN
      v_adv_deduction := v_adv_deduction + v_advance.net_amount;
      UPDATE public.receivable_advances SET status = 'liquidated' WHERE id = v_advance.id;
      INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_owner_wallet_id, 'advance_deduction', -v_advance.net_amount, 0, 0, 'receivable_advance', v_advance.id, 'Desconto automático antecipação');
    END IF;
  END LOOP;
  
  -- PRIORITY 2: Deduct credit installments
  FOR v_credit IN SELECT ci.id, ci.amount FROM public.credit_installments ci JOIN public.credit_transactions ct ON ct.id = ci.credit_transaction_id JOIN public.credit_accounts ca ON ca.id = ct.credit_account_id WHERE ca.profile_id = v_order.financial_owner_id AND ci.status = 'pending' AND ci.due_date <= (now() + interval '30 days') ORDER BY ci.due_date ASC
  LOOP
    IF v_cred_deduction + v_credit.amount <= (v_owner_amount - v_adv_deduction) THEN
      v_cred_deduction := v_cred_deduction + v_credit.amount;
      UPDATE public.credit_installments SET status = 'paid', paid_amount = v_credit.amount, paid_at = now() WHERE id = v_credit.id;
      INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_owner_wallet_id, 'credit_deduction', -v_credit.amount, 0, 0, 'credit_installment', v_credit.id, 'Desconto automático parcela crédito');
    END IF;
  END LOOP;
  
  -- PRIORITY 3: Net to owner
  v_net := v_owner_amount - v_adv_deduction - v_cred_deduction;
  
  SELECT available_balance INTO v_owner_balance_before FROM public.wallets WHERE id = v_owner_wallet_id FOR UPDATE;
  
  IF v_net > 0 THEN
    UPDATE public.wallets SET available_balance = available_balance + v_net, updated_at = now() WHERE id = v_owner_wallet_id;
  END IF;
  
  -- Release payer reserved
  UPDATE public.wallets SET reserved_balance = GREATEST(reserved_balance - v_order.gross_amount, 0), updated_at = now() WHERE id = v_payer_wallet_id;
  
  -- Platform revenue
  IF v_order.platform_fee_amount > 0 THEN
    INSERT INTO public.platform_revenue (payment_order_id, freight_id, amount, description) VALUES (p_payment_order_id, v_order.freight_id, v_order.platform_fee_amount, 'Comissão plataforma');
  END IF;
  
  -- Create payout record
  INSERT INTO public.payouts (payment_order_id, source_wallet_id, recipient_profile_id, recipient_wallet_id, gross_amount, credit_deduction, advance_deduction, net_amount, status, description, completed_at)
  VALUES (p_payment_order_id, v_payer_wallet_id, v_order.financial_owner_id, v_owner_wallet_id, v_owner_amount, v_cred_deduction, v_adv_deduction, v_net, 'completed', format('Split frete %s', v_order.freight_id), now())
  RETURNING id INTO v_payout_id;
  
  -- Ledger for net credit
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_owner_wallet_id, 'freight_split_credit', v_net, v_owner_balance_before, v_owner_balance_before + v_net, 'payout', v_payout_id, format('Liquidação: bruto R$%s - taxa R$%s - antecipação R$%s - crédito R$%s = líquido R$%s', v_order.gross_amount, v_order.platform_fee_amount, v_adv_deduction, v_cred_deduction, v_net));
  
  -- Update order final
  UPDATE public.payment_orders SET status_financial = 'fully_released', released_amount = v_owner_amount, advance_deduction = v_adv_deduction, credit_deduction = v_cred_deduction, net_amount = v_net, updated_at = now() WHERE id = p_payment_order_id;
  
  -- Update receivable
  UPDATE public.freight_receivables SET status = 'liquidated', liquidated_amount = v_owner_amount, updated_at = now() WHERE freight_id = v_order.freight_id;
  
  RETURN jsonb_build_object('payout_id', v_payout_id, 'gross', v_order.gross_amount, 'platform_fee', v_order.platform_fee_amount, 'owner_gross', v_owner_amount, 'advance_deduction', v_adv_deduction, 'credit_deduction', v_cred_deduction, 'net', v_net, 'status', 'fully_released');
END;
$$;

-- ============================================================
-- 3. SEPARATE PAYOUT (carrier -> affiliated driver)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_driver_payout(
  p_carrier_profile_id UUID,
  p_driver_profile_id UUID,
  p_amount NUMERIC,
  p_payment_order_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Repasse ao motorista'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_carrier_wallet UUID;
  v_driver_wallet UUID;
  v_carrier_available NUMERIC;
  v_carrier_before NUMERIC;
  v_driver_before NUMERIC;
  v_cred_deduction NUMERIC := 0;
  v_net NUMERIC;
  v_credit RECORD;
  v_payout_id UUID;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero'; END IF;
  
  v_carrier_wallet := public.ensure_wallet_exists(p_carrier_profile_id);
  v_driver_wallet := public.ensure_wallet_exists(p_driver_profile_id);
  
  SELECT available_balance INTO v_carrier_available FROM public.wallets WHERE id = v_carrier_wallet FOR UPDATE;
  IF v_carrier_available < p_amount THEN RAISE EXCEPTION 'Saldo insuficiente da transportadora'; END IF;
  v_carrier_before := v_carrier_available;
  
  -- Debit carrier
  UPDATE public.wallets SET available_balance = available_balance - p_amount, updated_at = now() WHERE id = v_carrier_wallet;
  
  -- Auto-deduct driver credit installments
  FOR v_credit IN SELECT ci.id, ci.amount FROM public.credit_installments ci JOIN public.credit_transactions ct ON ct.id = ci.credit_transaction_id JOIN public.credit_accounts ca ON ca.id = ct.credit_account_id WHERE ca.profile_id = p_driver_profile_id AND ci.status = 'pending' AND ci.due_date <= (now() + interval '30 days') ORDER BY ci.due_date ASC
  LOOP
    IF v_cred_deduction + v_credit.amount <= p_amount THEN
      v_cred_deduction := v_cred_deduction + v_credit.amount;
      UPDATE public.credit_installments SET status = 'paid', paid_amount = v_credit.amount, paid_at = now() WHERE id = v_credit.id;
      INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_driver_wallet, 'credit_deduction', -v_credit.amount, 0, 0, 'credit_installment', v_credit.id, 'Desconto automático parcela crédito no repasse');
    END IF;
  END LOOP;
  
  v_net := p_amount - v_cred_deduction;
  
  SELECT available_balance INTO v_driver_before FROM public.wallets WHERE id = v_driver_wallet FOR UPDATE;
  
  IF v_net > 0 THEN
    UPDATE public.wallets SET available_balance = available_balance + v_net, updated_at = now() WHERE id = v_driver_wallet;
  END IF;
  
  INSERT INTO public.payouts (payment_order_id, source_wallet_id, recipient_profile_id, recipient_wallet_id, gross_amount, credit_deduction, net_amount, status, description, completed_at)
  VALUES (p_payment_order_id, v_carrier_wallet, p_driver_profile_id, v_driver_wallet, p_amount, v_cred_deduction, v_net, 'completed', p_description, now())
  RETURNING id INTO v_payout_id;
  
  -- Ledger entries
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_carrier_wallet, 'payout_debit', -p_amount, v_carrier_before, v_carrier_before - p_amount, 'payout', v_payout_id, format('Repasse motorista: R$%s', p_amount));
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_driver_wallet, 'payout_credit', v_net, v_driver_before, v_driver_before + v_net, 'payout', v_payout_id, format('Repasse recebido: bruto R$%s - crédito R$%s = líquido R$%s', p_amount, v_cred_deduction, v_net));
  
  RETURN v_payout_id;
END;
$$;

-- Security
REVOKE EXECUTE ON FUNCTION public.create_payment_order FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_payment_order FROM anon;
GRANT EXECUTE ON FUNCTION public.create_payment_order TO authenticated;

REVOKE EXECUTE ON FUNCTION public.execute_freight_split FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_freight_split FROM anon;
GRANT EXECUTE ON FUNCTION public.execute_freight_split TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_driver_payout FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_driver_payout FROM anon;
GRANT EXECUTE ON FUNCTION public.create_driver_payout TO authenticated;

NOTIFY pgrst, 'reload schema';
