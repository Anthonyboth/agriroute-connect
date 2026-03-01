
CREATE TABLE public.freight_agreed_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  agreed_pricing_type TEXT NOT NULL,
  agreed_unit_rate NUMERIC NOT NULL,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  agreed_by_user_id UUID NOT NULL,
  agreed_by_role TEXT NOT NULL,
  agreed_location_lat DOUBLE PRECISION,
  agreed_location_lng DOUBLE PRECISION,
  agreed_location_accuracy_m DOUBLE PRECISION,
  agreed_location_source TEXT NOT NULL DEFAULT 'unknown',
  agreed_location_error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_freight_agreed_prices_freight_id ON public.freight_agreed_prices(freight_id);
CREATE INDEX idx_freight_agreed_prices_user ON public.freight_agreed_prices(agreed_by_user_id);

ALTER TABLE public.freight_agreed_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own agreed prices"
  ON public.freight_agreed_prices
  FOR SELECT
  USING (agreed_by_user_id = auth.uid());

CREATE POLICY "Freight producers can read agreed prices"
  ON public.freight_agreed_prices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.freights f 
      WHERE f.id = freight_id 
      AND f.producer_id IN (
        SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  );

COMMENT ON TABLE public.freight_agreed_prices IS 'Snapshot imutável do preço acordado no momento do aceite. Evidência legal contra calote.';
