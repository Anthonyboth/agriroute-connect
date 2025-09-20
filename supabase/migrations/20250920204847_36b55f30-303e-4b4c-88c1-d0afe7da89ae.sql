-- Sistema completo de pagamentos com Stripe
-- Criação das tabelas principais de pagamentos

-- Tabela principal de pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  amount_total NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'boleto', 'cartao', 'externo')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'succeeded', 'failed', 'refunded', 'external')),
  stripe_payment_id TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de saques dos motoristas
CREATE TABLE IF NOT EXISTS public.driver_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  pix_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  stripe_payout_id TEXT,
  stripe_account_id TEXT,
  platform_fee NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de pagamentos externos (fora da plataforma)
CREATE TABLE IF NOT EXISTS public.external_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  accepted_by_driver BOOLEAN DEFAULT false,
  confirmation_doc TEXT,
  notes TEXT,
  proposed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'confirmed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de contas Stripe Connect dos motoristas
CREATE TABLE IF NOT EXISTS public.driver_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  account_status TEXT NOT NULL DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'restricted', 'inactive')),
  pix_key TEXT,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  requirements_due JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de auditoria para todas as operações financeiras
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payments_freight_id ON public.payments(freight_id);
CREATE INDEX IF NOT EXISTS idx_payments_producer_id ON public.payments(producer_id);
CREATE INDEX IF NOT EXISTS idx_payments_driver_id ON public.payments(driver_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_id ON public.payments(stripe_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(payment_status);

CREATE INDEX IF NOT EXISTS idx_driver_withdrawals_driver_id ON public.driver_withdrawals(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_withdrawals_status ON public.driver_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_driver_withdrawals_stripe_account ON public.driver_withdrawals(stripe_account_id);

CREATE INDEX IF NOT EXISTS idx_external_payments_freight_id ON public.external_payments(freight_id);
CREATE INDEX IF NOT EXISTS idx_external_payments_status ON public.external_payments(status);

CREATE INDEX IF NOT EXISTS idx_driver_stripe_accounts_driver_id ON public.driver_stripe_accounts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_stripe_accounts_stripe_id ON public.driver_stripe_accounts(stripe_account_id);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_driver_withdrawals_updated_at
  BEFORE UPDATE ON public.driver_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_external_payments_updated_at
  BEFORE UPDATE ON public.external_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_driver_stripe_accounts_updated_at
  BEFORE UPDATE ON public.driver_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de auditoria para payments
CREATE OR REPLACE FUNCTION public.audit_payments()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, new_data, user_id)
    VALUES ('payments', NEW.id, TG_OP, row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, new_data, user_id)
    VALUES ('payments', NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, user_id)
    VALUES ('payments', OLD.id, TG_OP, row_to_json(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER audit_payments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_payments();

-- Trigger similar para driver_withdrawals
CREATE OR REPLACE FUNCTION public.audit_driver_withdrawals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, new_data, user_id)
    VALUES ('driver_withdrawals', NEW.id, TG_OP, row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, new_data, user_id)
    VALUES ('driver_withdrawals', NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, user_id)
    VALUES ('driver_withdrawals', OLD.id, TG_OP, row_to_json(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER audit_driver_withdrawals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.driver_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_driver_withdrawals();

-- Habilitar RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para payments
CREATE POLICY "Users can view their payments" ON public.payments
  FOR SELECT USING (
    producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    is_admin()
  );

CREATE POLICY "Producers can create payments" ON public.payments
  FOR INSERT WITH CHECK (
    producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'PRODUTOR')
  );

CREATE POLICY "System can update payments" ON public.payments
  FOR UPDATE USING (true);

-- Políticas RLS para driver_withdrawals
CREATE POLICY "Drivers can view their withdrawals" ON public.driver_withdrawals
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    is_admin()
  );

CREATE POLICY "Drivers can create withdrawals" ON public.driver_withdrawals
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA')
  );

CREATE POLICY "Admins can update withdrawals" ON public.driver_withdrawals
  FOR UPDATE USING (is_admin());

-- Políticas RLS para external_payments
CREATE POLICY "Users can view their external payments" ON public.external_payments
  FOR SELECT USING (
    producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    is_admin()
  );

CREATE POLICY "Producers can create external payments" ON public.external_payments
  FOR INSERT WITH CHECK (
    producer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'PRODUTOR')
  );

CREATE POLICY "Drivers can update external payments" ON public.external_payments
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA')
  );

-- Políticas RLS para driver_stripe_accounts
CREATE POLICY "Drivers can view their stripe accounts" ON public.driver_stripe_accounts
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    is_admin()
  );

CREATE POLICY "System can manage stripe accounts" ON public.driver_stripe_accounts
  FOR ALL USING (true);

-- Políticas RLS para financial_audit_logs
CREATE POLICY "Only admins can view audit logs" ON public.financial_audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert audit logs" ON public.financial_audit_logs
  FOR INSERT WITH CHECK (true);