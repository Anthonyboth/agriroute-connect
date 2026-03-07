
-- Autopay preferences per user
CREATE TABLE public.autopay_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  max_auto_deduct_percent INT NOT NULL DEFAULT 50, -- max % of released amount to auto-deduct
  pay_credit_installments BOOLEAN NOT NULL DEFAULT true,
  pay_platform_fees BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);
ALTER TABLE public.autopay_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own autopay" ON public.autopay_settings
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Dynamic credit based on receivables
CREATE TABLE public.dynamic_credit_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receivables_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  dynamic_limit NUMERIC(15,2) NOT NULL DEFAULT 0,
  utilization_percent INT NOT NULL DEFAULT 50, -- % of receivables as credit
  locked_receivable_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, recalculating
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);
ALTER TABLE public.dynamic_credit_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own dynamic credit" ON public.dynamic_credit_limits
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "System manages dynamic credit" ON public.dynamic_credit_limits
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Autopay execution log
CREATE TABLE public.autopay_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES public.credit_installments(id),
  amount NUMERIC(15,2) NOT NULL,
  source_transaction_id UUID,
  deduction_type TEXT NOT NULL, -- 'credit_installment', 'platform_fee'
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.autopay_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own autopay logs" ON public.autopay_logs
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users insert own autopay logs" ON public.autopay_logs
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
