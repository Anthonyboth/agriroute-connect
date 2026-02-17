
-- Table to track ANTT price sync attempts
CREATE TABLE public.antt_price_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  prices_updated INTEGER DEFAULT 0,
  raw_content TEXT,
  parsed_data JSONB,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.antt_price_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
ON public.antt_price_sync_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert sync logs"
ON public.antt_price_sync_logs FOR INSERT
WITH CHECK (true);

-- Add tracking columns to antt_freight_prices
ALTER TABLE public.antt_freight_prices 
ADD COLUMN IF NOT EXISTS last_sync_source TEXT,
ADD COLUMN IF NOT EXISTS antt_resolution TEXT;
