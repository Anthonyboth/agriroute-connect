-- Tabela para adiantamentos de frete
CREATE TABLE public.freight_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  requested_amount NUMERIC NOT NULL,
  approved_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  payment_method TEXT NOT NULL DEFAULT 'PIX' CHECK (payment_method IN ('PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA')),
  stripe_payment_intent_id TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para transações de pagamento
CREATE TABLE public.freight_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('FULL_PAYMENT', 'ADVANCE_PAYMENT', 'COMMISSION')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA', 'STRIPE')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  external_transaction_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para relatórios administrativos
CREATE TABLE public.admin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_freights INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  commission_earned NUMERIC DEFAULT 0,
  active_drivers INTEGER DEFAULT 0,
  active_producers INTEGER DEFAULT 0,
  average_freight_value NUMERIC DEFAULT 0,
  top_routes JSONB,
  user_growth JSONB,
  revenue_breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.freight_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies para freight_advances
CREATE POLICY "Users can view advances for their freights" ON freight_advances
FOR SELECT USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  is_admin()
);

CREATE POLICY "Drivers can request advances" ON freight_advances
FOR INSERT WITH CHECK (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA')
);

CREATE POLICY "Producers can approve advances" ON freight_advances
FOR UPDATE USING (
  producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'PRODUTOR') OR
  is_admin()
);

-- RLS Policies para freight_payments
CREATE POLICY "Users can view their payments" ON freight_payments
FOR SELECT USING (
  payer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  is_admin()
);

CREATE POLICY "Authenticated users can create payments" ON freight_payments
FOR INSERT WITH CHECK (
  payer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- RLS Policies para admin_reports
CREATE POLICY "Only admins can access reports" ON admin_reports
FOR ALL USING (is_admin());

-- Triggers para updated_at
CREATE TRIGGER update_freight_advances_updated_at
BEFORE UPDATE ON freight_advances
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_freight_payments_updated_at
BEFORE UPDATE ON freight_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar relatórios automaticamente
CREATE OR REPLACE FUNCTION generate_admin_report(
  p_report_type TEXT,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_id UUID;
  freight_count INTEGER;
  user_count INTEGER;
  total_rev NUMERIC;
  commission_total NUMERIC;
  active_driver_count INTEGER;
  active_producer_count INTEGER;
  avg_freight_val NUMERIC;
BEGIN
  -- Calcular estatísticas
  SELECT COUNT(*) INTO freight_count
  FROM freights 
  WHERE created_at::date BETWEEN p_period_start AND p_period_end;
  
  SELECT COUNT(*) INTO user_count
  FROM profiles 
  WHERE created_at::date BETWEEN p_period_start AND p_period_end;
  
  SELECT COALESCE(SUM(amount), 0) INTO total_rev
  FROM freight_payments 
  WHERE created_at::date BETWEEN p_period_start AND p_period_end 
  AND status = 'COMPLETED';
  
  SELECT COALESCE(SUM(commission_amount), 0) INTO commission_total
  FROM freights 
  WHERE created_at::date BETWEEN p_period_start AND p_period_end 
  AND status = 'DELIVERED';
  
  SELECT COUNT(DISTINCT driver_id) INTO active_driver_count
  FROM freights 
  WHERE created_at::date BETWEEN p_period_start AND p_period_end 
  AND driver_id IS NOT NULL;
  
  SELECT COUNT(*) INTO active_producer_count
  FROM profiles 
  WHERE role = 'PRODUTOR' 
  AND status = 'APPROVED'
  AND created_at::date BETWEEN p_period_start AND p_period_end;
  
  SELECT COALESCE(AVG(price), 0) INTO avg_freight_val
  FROM freights 
  WHERE created_at::date BETWEEN p_period_start AND p_period_end;
  
  -- Inserir relatório
  INSERT INTO admin_reports (
    report_type,
    period_start,
    period_end,
    total_freights,
    total_users,
    total_revenue,
    commission_earned,
    active_drivers,
    active_producers,
    average_freight_value,
    created_by
  ) VALUES (
    p_report_type,
    p_period_start,
    p_period_end,
    freight_count,
    user_count,
    total_rev,
    commission_total,
    active_driver_count,
    active_producer_count,
    avg_freight_val,
    (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) RETURNING id INTO report_id;
  
  RETURN report_id;
END;
$$;