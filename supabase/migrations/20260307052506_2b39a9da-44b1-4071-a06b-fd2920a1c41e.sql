
-- ================================================================
-- AgriRoute Wallet System - Complete Financial Architecture
-- ================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE wallet_type AS ENUM ('PRODUTOR', 'MOTORISTA', 'TRANSPORTADORA', 'PRESTADOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_status AS ENUM ('active', 'blocked', 'under_review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_transaction_type AS ENUM (
    'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'payment',
    'payout', 'refund', 'fee', 'credit_use', 'advance', 'auto_deduction',
    'reserve', 'release'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_transaction_status AS ENUM (
    'pending', 'completed', 'failed', 'cancelled', 'under_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE credit_account_status AS ENUM (
    'active', 'blocked', 'pending_approval', 'suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE credit_tx_type AS ENUM ('use', 'payment', 'auto_deduction', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE installment_status AS ENUM ('pending', 'paid', 'overdue', 'auto_deducted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE receivable_status AS ENUM (
    'eligible', 'partially_committed', 'fully_committed', 'liquidated', 'cancelled', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE advance_status AS ENUM ('pending', 'approved', 'disbursed', 'settled', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE risk_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM (
    'pending_review', 'approved', 'processing', 'completed', 'rejected', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pix_key_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE operation_owner_type AS ENUM ('driver', 'carrier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. WALLETS
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_type wallet_type NOT NULL,
  available_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  pending_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  reserved_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  blocked_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  status wallet_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- 3. LEDGER ENTRIES (append-only source of truth)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  balance_before NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  balance_after NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_type wallet_transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status wallet_transaction_status NOT NULL DEFAULT 'pending',
  pix_key TEXT,
  pix_key_type pix_key_type,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 5. CREDIT ACCOUNTS
CREATE TABLE IF NOT EXISTS public.credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_limit NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  used_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  available_limit NUMERIC(15,2) GENERATED ALWAYS AS (credit_limit - used_amount) STORED,
  status credit_account_status NOT NULL DEFAULT 'pending_approval',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- 6. CREDIT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id UUID NOT NULL REFERENCES public.credit_accounts(id) ON DELETE CASCADE,
  transaction_type credit_tx_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  installments INT DEFAULT 1,
  freight_id UUID REFERENCES public.freights(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. CREDIT INSTALLMENTS
CREATE TABLE IF NOT EXISTS public.credit_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_transaction_id UUID NOT NULL REFERENCES public.credit_transactions(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount NUMERIC(15,2) DEFAULT 0.00,
  paid_at TIMESTAMPTZ,
  status installment_status NOT NULL DEFAULT 'pending'
);

-- 8. FREIGHT RECEIVABLES
CREATE TABLE IF NOT EXISTS public.freight_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  owner_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  owner_type operation_owner_type NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  committed_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  liquidated_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  status receivable_status NOT NULL DEFAULT 'eligible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. RECEIVABLE ADVANCES
CREATE TABLE IF NOT EXISTS public.receivable_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  total_requested NUMERIC(15,2) NOT NULL,
  fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(15,2) NOT NULL,
  status advance_status NOT NULL DEFAULT 'pending',
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. RECEIVABLE ADVANCE ALLOCATIONS
CREATE TABLE IF NOT EXISTS public.receivable_advance_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id UUID NOT NULL REFERENCES public.receivable_advances(id) ON DELETE CASCADE,
  receivable_id UUID NOT NULL REFERENCES public.freight_receivables(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(15,2) NOT NULL,
  settled_amount NUMERIC(15,2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'allocated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. DISPUTES
CREATE TABLE IF NOT EXISTS public.wallet_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  status dispute_status NOT NULL DEFAULT 'open',
  reason TEXT,
  resolution TEXT,
  freight_id UUID REFERENCES public.freights(id),
  opened_by UUID REFERENCES public.profiles(id),
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 12. DISPUTE EVIDENCE
CREATE TABLE IF NOT EXISTS public.wallet_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.wallet_disputes(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL DEFAULT 'document',
  file_url TEXT,
  description TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. WALLET RISK EVENTS
CREATE TABLE IF NOT EXISTS public.wallet_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity risk_severity NOT NULL DEFAULT 'low',
  description TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. PAYOUT ORDERS
CREATE TABLE IF NOT EXISTS public.payout_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  pix_key TEXT NOT NULL,
  pix_key_type pix_key_type NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 15. ADMIN FINANCIAL AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.admin_financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. RECONCILIATION RUNS
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_wallets INT NOT NULL DEFAULT 0,
  inconsistencies_found INT NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. ADD COLUMNS TO FREIGHTS (operation ownership)
DO $$ BEGIN
  ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS operation_owner_type operation_owner_type;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS financial_owner_id UUID REFERENCES public.profiles(id);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS executor_driver_id UUID REFERENCES public.profiles(id);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_wallets_profile_id ON public.wallets(profile_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id ON public.ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON public.ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON public.wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_profile ON public.credit_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_freight_receivables_freight ON public.freight_receivables(freight_id);
CREATE INDEX IF NOT EXISTS idx_freight_receivables_wallet ON public.freight_receivables(owner_wallet_id);
CREATE INDEX IF NOT EXISTS idx_payout_orders_wallet ON public.payout_orders(wallet_id);
CREATE INDEX IF NOT EXISTS idx_payout_orders_status ON public.payout_orders(status);
CREATE INDEX IF NOT EXISTS idx_disputes_wallet ON public.wallet_disputes(wallet_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_profile ON public.wallet_risk_events(profile_id);

-- ================================================================
-- RLS POLICIES
-- ================================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_advance_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

-- WALLETS: Owner can read own wallet
CREATE POLICY "wallet_select_own" ON public.wallets
  FOR SELECT TO authenticated
  USING (profile_id = public.get_my_profile_id());

CREATE POLICY "wallet_update_own" ON public.wallets
  FOR UPDATE TO authenticated
  USING (profile_id = public.get_my_profile_id());

-- LEDGER: Owner can read own entries (append-only, no update/delete for users)
CREATE POLICY "ledger_select_own" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

-- WALLET TRANSACTIONS: Owner can read/insert own
CREATE POLICY "wallet_tx_select_own" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

CREATE POLICY "wallet_tx_insert_own" ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

-- CREDIT ACCOUNTS: Owner reads own
CREATE POLICY "credit_select_own" ON public.credit_accounts
  FOR SELECT TO authenticated
  USING (profile_id = public.get_my_profile_id());

-- CREDIT TRANSACTIONS: Owner reads own
CREATE POLICY "credit_tx_select_own" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (credit_account_id IN (
    SELECT id FROM public.credit_accounts WHERE profile_id = public.get_my_profile_id()
  ));

-- CREDIT INSTALLMENTS: Owner reads own
CREATE POLICY "installment_select_own" ON public.credit_installments
  FOR SELECT TO authenticated
  USING (credit_transaction_id IN (
    SELECT ct.id FROM public.credit_transactions ct
    JOIN public.credit_accounts ca ON ct.credit_account_id = ca.id
    WHERE ca.profile_id = public.get_my_profile_id()
  ));

-- FREIGHT RECEIVABLES: Owner reads own
CREATE POLICY "receivable_select_own" ON public.freight_receivables
  FOR SELECT TO authenticated
  USING (owner_wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

-- RECEIVABLE ADVANCES: Owner reads own
CREATE POLICY "advance_select_own" ON public.receivable_advances
  FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

-- ADVANCE ALLOCATIONS: Owner reads own
CREATE POLICY "allocation_select_own" ON public.receivable_advance_allocations
  FOR SELECT TO authenticated
  USING (advance_id IN (
    SELECT id FROM public.receivable_advances WHERE wallet_id IN (
      SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()
    )
  ));

-- DISPUTES: Owner reads own
CREATE POLICY "dispute_select_own" ON public.wallet_disputes
  FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

CREATE POLICY "dispute_insert_own" ON public.wallet_disputes
  FOR INSERT TO authenticated
  WITH CHECK (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

-- DISPUTE EVIDENCE: Owner reads own
CREATE POLICY "evidence_select_own" ON public.wallet_dispute_evidence
  FOR SELECT TO authenticated
  USING (dispute_id IN (
    SELECT id FROM public.wallet_disputes WHERE wallet_id IN (
      SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()
    )
  ));

CREATE POLICY "evidence_insert_own" ON public.wallet_dispute_evidence
  FOR INSERT TO authenticated
  WITH CHECK (dispute_id IN (
    SELECT id FROM public.wallet_disputes WHERE wallet_id IN (
      SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()
    )
  ));

-- RISK EVENTS: Owner reads own
CREATE POLICY "risk_select_own" ON public.wallet_risk_events
  FOR SELECT TO authenticated
  USING (profile_id = public.get_my_profile_id());

-- PAYOUT ORDERS: Owner reads own
CREATE POLICY "payout_select_own" ON public.payout_orders
  FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

CREATE POLICY "payout_insert_own" ON public.payout_orders
  FOR INSERT TO authenticated
  WITH CHECK (wallet_id IN (SELECT id FROM public.wallets WHERE profile_id = public.get_my_profile_id()));

-- ADMIN AUDIT LOGS: Only admin reads
CREATE POLICY "admin_audit_select" ON public.admin_financial_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RECONCILIATION: Only admin reads
CREATE POLICY "recon_select_admin" ON public.reconciliation_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ================================================================
-- AUTO-CREATE WALLET FUNCTION
-- ================================================================
CREATE OR REPLACE FUNCTION public.ensure_wallet_exists(p_profile_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_role TEXT;
  v_wallet_type wallet_type;
BEGIN
  -- Check if wallet exists
  SELECT id INTO v_wallet_id FROM public.wallets WHERE profile_id = p_profile_id;
  
  IF v_wallet_id IS NOT NULL THEN
    RETURN v_wallet_id;
  END IF;
  
  -- Get user role
  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id;
  
  -- Map role to wallet_type
  v_wallet_type := CASE 
    WHEN UPPER(v_role) = 'PRODUTOR' THEN 'PRODUTOR'::wallet_type
    WHEN UPPER(v_role) = 'MOTORISTA' THEN 'MOTORISTA'::wallet_type
    WHEN UPPER(v_role) = 'TRANSPORTADORA' THEN 'TRANSPORTADORA'::wallet_type
    ELSE 'PRESTADOR'::wallet_type
  END;
  
  -- Create wallet
  INSERT INTO public.wallets (profile_id, wallet_type)
  VALUES (p_profile_id, v_wallet_type)
  ON CONFLICT (profile_id) DO NOTHING
  RETURNING id INTO v_wallet_id;
  
  -- If conflict, fetch existing
  IF v_wallet_id IS NULL THEN
    SELECT id INTO v_wallet_id FROM public.wallets WHERE profile_id = p_profile_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$;

-- Grant to authenticated
GRANT EXECUTE ON FUNCTION public.ensure_wallet_exists(UUID) TO authenticated;

-- ================================================================
-- WALLET DEPOSIT RPC (with ledger entry)
-- ================================================================
CREATE OR REPLACE FUNCTION public.wallet_deposit(
  p_profile_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Depósito'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance_before NUMERIC;
  v_tx_id UUID;
BEGIN
  -- Ensure wallet exists
  v_wallet_id := public.ensure_wallet_exists(p_profile_id);
  
  -- Get current balance
  SELECT available_balance INTO v_balance_before FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  
  -- Update balance
  UPDATE public.wallets 
  SET available_balance = available_balance + p_amount, updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, completed_at)
  VALUES (v_wallet_id, 'deposit', p_amount, 'completed', p_description, p_profile_id, now())
  RETURNING id INTO v_tx_id;
  
  -- Create ledger entry
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_wallet_id, 'deposit', p_amount, v_balance_before, v_balance_before + p_amount, 'wallet_transaction', v_tx_id, p_description);
  
  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_deposit(UUID, NUMERIC, TEXT) TO authenticated;

-- ================================================================
-- WALLET WITHDRAW RPC
-- ================================================================
CREATE OR REPLACE FUNCTION public.wallet_withdraw(
  p_profile_id UUID,
  p_amount NUMERIC,
  p_pix_key TEXT,
  p_pix_key_type pix_key_type,
  p_description TEXT DEFAULT 'Saque via Pix'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_available NUMERIC;
  v_balance_before NUMERIC;
  v_payout_id UUID;
  v_tx_id UUID;
BEGIN
  v_wallet_id := public.ensure_wallet_exists(p_profile_id);
  
  SELECT available_balance INTO v_available FROM public.wallets WHERE id = v_wallet_id FOR UPDATE;
  
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_available, p_amount;
  END IF;
  
  v_balance_before := v_available;
  
  -- Debit balance
  UPDATE public.wallets 
  SET available_balance = available_balance - p_amount, pending_balance = pending_balance + p_amount, updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create payout order
  INSERT INTO public.payout_orders (wallet_id, amount, pix_key, pix_key_type)
  VALUES (v_wallet_id, p_amount, p_pix_key, p_pix_key_type)
  RETURNING id INTO v_payout_id;
  
  -- Create transaction
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, pix_key, pix_key_type, description, created_by)
  VALUES (v_wallet_id, 'withdrawal', p_amount, 'pending', p_pix_key, p_pix_key_type, p_description, p_profile_id)
  RETURNING id INTO v_tx_id;
  
  -- Ledger
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_wallet_id, 'withdrawal', -p_amount, v_balance_before, v_balance_before - p_amount, 'payout_order', v_payout_id, p_description);
  
  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_withdraw(UUID, NUMERIC, TEXT, pix_key_type, TEXT) TO authenticated;

-- ================================================================
-- WALLET TRANSFER RPC (internal)
-- ================================================================
CREATE OR REPLACE FUNCTION public.wallet_transfer(
  p_from_profile_id UUID,
  p_to_profile_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT 'Transferência interna'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_wallet_id UUID;
  v_to_wallet_id UUID;
  v_from_balance NUMERIC;
  v_to_balance NUMERIC;
  v_tx_id UUID;
BEGIN
  v_from_wallet_id := public.ensure_wallet_exists(p_from_profile_id);
  v_to_wallet_id := public.ensure_wallet_exists(p_to_profile_id);
  
  SELECT available_balance INTO v_from_balance FROM public.wallets WHERE id = v_from_wallet_id FOR UPDATE;
  SELECT available_balance INTO v_to_balance FROM public.wallets WHERE id = v_to_wallet_id FOR UPDATE;
  
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente para transferência';
  END IF;
  
  -- Debit sender
  UPDATE public.wallets SET available_balance = available_balance - p_amount, updated_at = now() WHERE id = v_from_wallet_id;
  -- Credit receiver
  UPDATE public.wallets SET available_balance = available_balance + p_amount, updated_at = now() WHERE id = v_to_wallet_id;
  
  -- Tx for sender
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, completed_at)
  VALUES (v_from_wallet_id, 'transfer_out', p_amount, 'completed', p_description, p_from_profile_id, now())
  RETURNING id INTO v_tx_id;
  
  -- Tx for receiver
  INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, status, description, created_by, completed_at)
  VALUES (v_to_wallet_id, 'transfer_in', p_amount, 'completed', p_description, p_from_profile_id, now());
  
  -- Ledger sender
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_from_wallet_id, 'transfer_out', -p_amount, v_from_balance, v_from_balance - p_amount, 'wallet_transaction', v_tx_id, p_description);
  
  -- Ledger receiver
  INSERT INTO public.ledger_entries (wallet_id, entry_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (v_to_wallet_id, 'transfer_in', p_amount, v_to_balance, v_to_balance + p_amount, 'wallet_transaction', v_tx_id, p_description);
  
  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_transfer(UUID, UUID, NUMERIC, TEXT) TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
