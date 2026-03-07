
DO $$ BEGIN CREATE TYPE public.payment_order_op_status AS ENUM ('pending_collection','collected','in_transit','delivered_pending','delivered','completed','cancelled','disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_order_fin_status AS ENUM ('pending_payment','paid_reserved','processing_split','partially_released','fully_released','blocked','refunded','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID REFERENCES public.freights(id) ON DELETE SET NULL,
  payer_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  operation_owner_type TEXT NOT NULL CHECK (operation_owner_type IN ('carrier', 'driver', 'producer')),
  financial_owner_id UUID NOT NULL REFERENCES public.profiles(id),
  executor_id UUID REFERENCES public.profiles(id),
  gross_amount NUMERIC NOT NULL CHECK (gross_amount > 0),
  platform_fee_amount NUMERIC NOT NULL DEFAULT 0 CHECK (platform_fee_amount >= 0),
  reserved_amount NUMERIC NOT NULL DEFAULT 0 CHECK (reserved_amount >= 0),
  released_amount NUMERIC NOT NULL DEFAULT 0 CHECK (released_amount >= 0),
  blocked_amount NUMERIC NOT NULL DEFAULT 0 CHECK (blocked_amount >= 0),
  advance_deduction NUMERIC NOT NULL DEFAULT 0 CHECK (advance_deduction >= 0),
  credit_deduction NUMERIC NOT NULL DEFAULT 0 CHECK (credit_deduction >= 0),
  net_amount NUMERIC NOT NULL DEFAULT 0 CHECK (net_amount >= 0),
  status_operational payment_order_op_status NOT NULL DEFAULT 'pending_collection',
  status_financial payment_order_fin_status NOT NULL DEFAULT 'pending_payment',
  contestation_window_ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_orders_select_own" ON public.payment_orders FOR SELECT TO authenticated USING (payer_profile_id = (SELECT public.get_my_profile_id()) OR financial_owner_id = (SELECT public.get_my_profile_id()) OR executor_id = (SELECT public.get_my_profile_id()) OR public.is_admin());
CREATE POLICY "payment_orders_admin_all" ON public.payment_orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX idx_payment_orders_freight ON public.payment_orders(freight_id);
CREATE INDEX idx_payment_orders_payer ON public.payment_orders(payer_profile_id);
CREATE INDEX idx_payment_orders_owner ON public.payment_orders(financial_owner_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status_financial);

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID REFERENCES public.payment_orders(id),
  source_wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  recipient_profile_id UUID NOT NULL REFERENCES public.profiles(id),
  recipient_wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  gross_amount NUMERIC NOT NULL CHECK (gross_amount > 0),
  credit_deduction NUMERIC NOT NULL DEFAULT 0,
  advance_deduction NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL CHECK (net_amount >= 0),
  status payout_status NOT NULL DEFAULT 'pending_review',
  description TEXT,
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_select_own" ON public.payouts FOR SELECT TO authenticated USING (recipient_profile_id = (SELECT public.get_my_profile_id()) OR public.is_admin());
CREATE POLICY "payouts_admin_all" ON public.payouts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX idx_payouts_recipient ON public.payouts(recipient_profile_id);
CREATE INDEX idx_payouts_order ON public.payouts(payment_order_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);

CREATE TABLE public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id),
  freight_id UUID REFERENCES public.freights(id),
  fee_type TEXT NOT NULL DEFAULT 'platform_commission',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_revenue_admin_only" ON public.platform_revenue FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX idx_platform_revenue_order ON public.platform_revenue(payment_order_id);

CREATE TRIGGER set_payment_orders_updated_at BEFORE UPDATE ON public.payment_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_payouts_updated_at BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
