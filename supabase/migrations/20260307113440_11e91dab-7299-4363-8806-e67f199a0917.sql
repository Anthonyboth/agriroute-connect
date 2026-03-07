
-- 1. FIX SECURITY: city_hierarchy view - restrict to authenticated
REVOKE ALL ON public.city_hierarchy FROM PUBLIC;
REVOKE ALL ON public.city_hierarchy FROM anon;
GRANT SELECT ON public.city_hierarchy TO authenticated;

-- 2. ESCROW: Reserve freight payment in reserved_balance
CREATE OR REPLACE FUNCTION public.freight_escrow_reserve(
  p_payer_profile_id UUID,
  p_freight_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Reserva escrow de frete'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_id UUID;
  v_available NUMERIC;
  v_balance_before NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;
  v_wallet_id := public.ensure_wallet_exists(p_payer_profile_id);
  SELECT available_balance INTO v_available FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_available, p_amount;
  END IF;
  v_balance_before := v_available;
  UPDATE public.wallets SET available_balance = available_balance - p_amount, reserved_balance = reserved_balance + p_amount, updated_at = now() WHERE id = v_wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, metadata) VALUES (v_wallet_id, 'escrow_reserve', p_amount, 'reserved', p_description, p_payer_profile_id, jsonb_build_object('freight_id', p_freight_id, 'stage', 'reserved')) RETURNING id INTO v_tx_id;
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_wallet_id, 'escrow_reserve', -p_amount, v_balance_before, v_balance_before - p_amount, 'freight', p_freight_id, p_description);
  RETURN v_tx_id;
END;
$$;

-- 3. ESCROW: Liquidate freight with priority deductions
CREATE OR REPLACE FUNCTION public.freight_escrow_liquidate(
  p_freight_id UUID,
  p_receiver_profile_id UUID,
  p_description TEXT DEFAULT 'Liquidação de frete'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_receiver_wallet_id UUID;
  v_payer_wallet_id UUID;
  v_freight_amount NUMERIC;
  v_advance_deduction NUMERIC := 0;
  v_credit_deduction NUMERIC := 0;
  v_net_amount NUMERIC;
  v_balance_before NUMERIC;
  v_tx_id UUID;
  v_recv_total NUMERIC;
  v_recv_liq NUMERIC;
  v_recv_wallet UUID;
  v_advance RECORD;
  v_credit RECORD;
BEGIN
  v_receiver_wallet_id := public.ensure_wallet_exists(p_receiver_profile_id);
  SELECT fr.owner_wallet_id, fr.total_amount, COALESCE(fr.liquidated_amount, 0) INTO v_recv_wallet, v_recv_total, v_recv_liq FROM public.freight_receivables fr WHERE fr.freight_id = p_freight_id AND fr.status IN ('reserved', 'eligible', 'partially_committed') LIMIT 1;
  IF v_recv_wallet IS NULL THEN RAISE EXCEPTION 'Nenhum recebível encontrado para o frete %', p_freight_id; END IF;
  v_freight_amount := v_recv_total - v_recv_liq;
  v_payer_wallet_id := v_recv_wallet;
  IF v_freight_amount <= 0 THEN RAISE EXCEPTION 'Frete já foi totalmente liquidado'; END IF;

  -- PRIORITY 1: Deduct advances
  FOR v_advance IN SELECT ra.id, ra.net_amount FROM public.receivable_advances ra WHERE ra.wallet_id = v_receiver_wallet_id AND ra.status = 'approved' ORDER BY ra.created_at ASC
  LOOP
    IF v_advance_deduction + v_advance.net_amount <= v_freight_amount THEN
      v_advance_deduction := v_advance_deduction + v_advance.net_amount;
      UPDATE public.receivable_advances SET status = 'liquidated' WHERE id = v_advance.id;
      INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_receiver_wallet_id, 'advance_deduction', -v_advance.net_amount, 0, 0, 'receivable_advance', v_advance.id, 'Desconto automático - antecipação');
    END IF;
  END LOOP;

  -- PRIORITY 2: Deduct credit installments
  FOR v_credit IN SELECT ci.id, ci.amount FROM public.credit_installments ci JOIN public.credit_transactions ct ON ct.id = ci.credit_transaction_id JOIN public.credit_accounts ca ON ca.id = ct.credit_account_id WHERE ca.profile_id = p_receiver_profile_id AND ci.status = 'pending' AND ci.due_date <= (now() + interval '30 days') ORDER BY ci.due_date ASC
  LOOP
    IF v_credit_deduction + v_credit.amount <= (v_freight_amount - v_advance_deduction) THEN
      v_credit_deduction := v_credit_deduction + v_credit.amount;
      UPDATE public.credit_installments SET status = 'paid', paid_amount = v_credit.amount, paid_at = now() WHERE id = v_credit.id;
      INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_receiver_wallet_id, 'credit_deduction', -v_credit.amount, 0, 0, 'credit_installment', v_credit.id, 'Desconto automático - parcela crédito');
    END IF;
  END LOOP;

  -- PRIORITY 3: Release remaining
  v_net_amount := v_freight_amount - v_advance_deduction - v_credit_deduction;
  SELECT available_balance INTO v_balance_before FROM public.wallets WHERE id = v_receiver_wallet_id FOR UPDATE;
  IF v_net_amount > 0 THEN UPDATE public.wallets SET available_balance = available_balance + v_net_amount, updated_at = now() WHERE id = v_receiver_wallet_id; END IF;
  UPDATE public.wallets SET reserved_balance = GREATEST(reserved_balance - v_freight_amount, 0), updated_at = now() WHERE id = v_payer_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, completed_at, metadata) VALUES (v_receiver_wallet_id, 'freight_liquidation', v_freight_amount, 'completed', p_description, p_receiver_profile_id, now(), jsonb_build_object('freight_id', p_freight_id, 'gross_amount', v_freight_amount, 'advance_deduction', v_advance_deduction, 'credit_deduction', v_credit_deduction, 'net_amount', v_net_amount)) RETURNING id INTO v_tx_id;

  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_receiver_wallet_id, 'freight_liquidation', v_net_amount, v_balance_before, v_balance_before + v_net_amount, 'freight', p_freight_id, format('Liquidação: bruto R$%s - antecipação R$%s - crédito R$%s = líquido R$%s', v_freight_amount, v_advance_deduction, v_credit_deduction, v_net_amount));

  UPDATE public.freight_receivables SET status = 'liquidated', liquidated_amount = v_freight_amount, updated_at = now() WHERE freight_id = p_freight_id AND status IN ('reserved', 'eligible', 'partially_committed');

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'freight_id', p_freight_id, 'gross_amount', v_freight_amount, 'advance_deduction', v_advance_deduction, 'credit_deduction', v_credit_deduction, 'net_amount', v_net_amount, 'status', 'liquidated');
END;
$$;

-- 4. BLOCK funds (disputes/risk)
CREATE OR REPLACE FUNCTION public.wallet_block_funds(p_profile_id UUID, p_amount NUMERIC, p_reason TEXT, p_reference_type TEXT DEFAULT NULL, p_reference_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_wallet_id UUID; v_available NUMERIC; v_balance_before NUMERIC; v_tx_id UUID;
BEGIN
  v_wallet_id := public.ensure_wallet_exists(p_profile_id);
  SELECT available_balance INTO v_available FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  IF v_available < p_amount THEN RAISE EXCEPTION 'Saldo insuficiente para bloqueio'; END IF;
  v_balance_before := v_available;
  UPDATE public.wallets SET available_balance = available_balance - p_amount, blocked_balance = blocked_balance + p_amount, updated_at = now() WHERE id = v_wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, metadata) VALUES (v_wallet_id, 'block', p_amount, 'blocked', p_reason, p_profile_id, jsonb_build_object('reason', p_reason, 'reference_type', p_reference_type, 'reference_id', p_reference_id)) RETURNING id INTO v_tx_id;
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_wallet_id, 'block', -p_amount, v_balance_before, v_balance_before - p_amount, COALESCE(p_reference_type, 'manual'), p_reference_id, p_reason);
  RETURN v_tx_id;
END;
$$;

-- 5. UNBLOCK funds
CREATE OR REPLACE FUNCTION public.wallet_unblock_funds(p_profile_id UUID, p_amount NUMERIC, p_reason TEXT, p_reference_type TEXT DEFAULT NULL, p_reference_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_wallet_id UUID; v_blocked NUMERIC; v_balance_before NUMERIC; v_tx_id UUID;
BEGIN
  v_wallet_id := public.ensure_wallet_exists(p_profile_id);
  SELECT blocked_balance, available_balance INTO v_blocked, v_balance_before FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  IF v_blocked < p_amount THEN RAISE EXCEPTION 'Saldo bloqueado insuficiente'; END IF;
  UPDATE public.wallets SET blocked_balance = blocked_balance - p_amount, available_balance = available_balance + p_amount, updated_at = now() WHERE id = v_wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, completed_at) VALUES (v_wallet_id, 'unblock', p_amount, 'completed', p_reason, p_profile_id, now()) RETURNING id INTO v_tx_id;
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES (v_wallet_id, 'unblock', p_amount, v_balance_before, v_balance_before + p_amount, COALESCE(p_reference_type, 'manual'), p_reference_id, p_reason);
  RETURN v_tx_id;
END;
$$;

-- 6. SECURITY: Revoke from PUBLIC/anon
REVOKE EXECUTE ON FUNCTION public.freight_escrow_reserve FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.freight_escrow_reserve FROM anon;
GRANT EXECUTE ON FUNCTION public.freight_escrow_reserve TO authenticated;
REVOKE EXECUTE ON FUNCTION public.freight_escrow_liquidate FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.freight_escrow_liquidate FROM anon;
GRANT EXECUTE ON FUNCTION public.freight_escrow_liquidate TO authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_block_funds FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_block_funds FROM anon;
GRANT EXECUTE ON FUNCTION public.wallet_block_funds TO authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_unblock_funds FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_unblock_funds FROM anon;
GRANT EXECUTE ON FUNCTION public.wallet_unblock_funds TO authenticated;

NOTIFY pgrst, 'reload schema';
