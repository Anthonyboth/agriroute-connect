
-- Tabela de acordos de preço imutáveis (snapshot do valor acordado entre as partes)
CREATE TABLE public.freight_price_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL REFERENCES public.freights(id) ON DELETE CASCADE,
  agreed_pricing_type TEXT NOT NULL CHECK (agreed_pricing_type IN ('PER_VEHICLE', 'PER_KM', 'PER_TON')),
  agreed_unit_rate NUMERIC(12,2) NOT NULL CHECK (agreed_unit_rate > 0),
  agreed_total NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  agreed_by_driver_id UUID REFERENCES public.profiles(id),
  agreed_by_requester_id UUID REFERENCES public.profiles(id),
  driver_role TEXT,
  requester_role TEXT,
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  driver_location_lat DOUBLE PRECISION,
  driver_location_lng DOUBLE PRECISION,
  driver_location_accuracy_m DOUBLE PRECISION,
  driver_location_source TEXT DEFAULT 'unknown',
  requester_location_lat DOUBLE PRECISION,
  requester_location_lng DOUBLE PRECISION,
  requester_location_accuracy_m DOUBLE PRECISION,
  requester_location_source TEXT DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'DISPUTED', 'CANCELLED')),
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by freight
CREATE INDEX idx_freight_price_agreements_freight ON public.freight_price_agreements(freight_id);
CREATE INDEX idx_freight_price_agreements_active ON public.freight_price_agreements(freight_id, status) WHERE status = 'ACTIVE';

-- RLS
ALTER TABLE public.freight_price_agreements ENABLE ROW LEVEL SECURITY;

-- Participants can read agreements they're part of
CREATE POLICY "Participants can view their agreements"
  ON public.freight_price_agreements
  FOR SELECT
  USING (
    agreed_by_driver_id = auth.uid()
    OR agreed_by_requester_id = auth.uid()
  );

-- Only service role can insert (via edge functions)
CREATE POLICY "Service role can manage agreements"
  ON public.freight_price_agreements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE public.freight_price_agreements IS 'Snapshot imutável do preço acordado entre solicitante e motorista no momento do aceite. Captura geolocalização best-effort.';
