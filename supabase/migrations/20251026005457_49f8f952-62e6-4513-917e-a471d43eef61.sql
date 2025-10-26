-- Criar tabela de histórico de recálculos ANTT
CREATE TABLE IF NOT EXISTS public.antt_recalculation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_by UUID REFERENCES public.profiles(id),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  freights_processed INTEGER NOT NULL DEFAULT 0,
  freights_updated INTEGER NOT NULL DEFAULT 0,
  freights_failed INTEGER NOT NULL DEFAULT 0,
  freights_skipped INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  details JSONB DEFAULT '{}'::jsonb,
  error_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.antt_recalculation_history ENABLE ROW LEVEL SECURITY;

-- Admins can view history
CREATE POLICY "Admins can view recalculation history"
ON public.antt_recalculation_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- System can insert history
CREATE POLICY "System can insert recalculation history"
ON public.antt_recalculation_history
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_antt_recalc_history_executed_at 
ON public.antt_recalculation_history(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_antt_recalc_history_executed_by 
ON public.antt_recalculation_history(executed_by);

COMMENT ON TABLE public.antt_recalculation_history IS 'Histórico de execuções de recálculo em lote de preços ANTT';
COMMENT ON COLUMN public.antt_recalculation_history.details IS 'Detalhes adicionais da execução (JSON)';
COMMENT ON COLUMN public.antt_recalculation_history.error_messages IS 'Lista de erros encontrados durante execução';