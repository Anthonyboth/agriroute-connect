-- Tabela para despesas/abastecimentos do motorista
CREATE TABLE public.driver_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('FUEL', 'MAINTENANCE', 'TOLL', 'TIRE', 'OTHER')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Campos específicos para combustível
  liters DECIMAL(10,3),
  price_per_liter DECIMAL(10,3),
  km_reading DECIMAL(10,1),
  -- Referências
  vehicle_id UUID REFERENCES public.vehicles(id),
  freight_id UUID REFERENCES public.freights(id),
  receipt_url TEXT,
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_driver_expenses_driver_id ON public.driver_expenses(driver_id);
CREATE INDEX idx_driver_expenses_date ON public.driver_expenses(expense_date DESC);
CREATE INDEX idx_driver_expenses_type ON public.driver_expenses(expense_type);

-- Enable RLS
ALTER TABLE public.driver_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Motoristas podem ver suas próprias despesas"
ON public.driver_expenses FOR SELECT
USING (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Motoristas podem inserir suas próprias despesas"
ON public.driver_expenses FOR INSERT
WITH CHECK (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Motoristas podem atualizar suas próprias despesas"
ON public.driver_expenses FOR UPDATE
USING (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Motoristas podem deletar suas próprias despesas"
ON public.driver_expenses FOR DELETE
USING (driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins podem ver todas
CREATE POLICY "Admins podem ver todas as despesas"
ON public.driver_expenses FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_driver_expenses_updated_at
BEFORE UPDATE ON public.driver_expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();