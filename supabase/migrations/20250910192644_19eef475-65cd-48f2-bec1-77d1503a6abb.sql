-- Add new service types to freight_status enum
ALTER TYPE freight_status ADD VALUE IF NOT EXISTS 'GUINCHO';
ALTER TYPE freight_status ADD VALUE IF NOT EXISTS 'MUDANCA';

-- Create table for ANTT freight prices
CREATE TABLE IF NOT EXISTS public.antt_freight_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type TEXT NOT NULL, -- 'CARGA', 'GUINCHO', 'MUDANCA'
  distance_range_min INTEGER NOT NULL,
  distance_range_max INTEGER,
  price_per_km NUMERIC(10,2) NOT NULL,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.antt_freight_prices ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read prices (public data)
CREATE POLICY "Anyone can view ANTT prices" 
ON public.antt_freight_prices 
FOR SELECT 
USING (true);

-- Insert sample ANTT-based pricing for different services
INSERT INTO public.antt_freight_prices (service_type, distance_range_min, distance_range_max, price_per_km, base_price) VALUES
-- Carga geral (existing freight)
('CARGA', 0, 50, 3.50, 150.00),
('CARGA', 51, 100, 3.20, 200.00),
('CARGA', 101, 300, 2.90, 250.00),
('CARGA', 301, 500, 2.70, 300.00),
('CARGA', 501, NULL, 2.50, 350.00),

-- Guincho (tow truck services)
('GUINCHO', 0, 30, 8.50, 250.00),
('GUINCHO', 31, 80, 7.80, 350.00),
('GUINCHO', 81, 150, 7.20, 450.00),
('GUINCHO', 151, NULL, 6.80, 550.00),

-- Mudança (moving services)
('MUDANCA', 0, 50, 4.20, 300.00),
('MUDANCA', 51, 100, 3.80, 400.00),
('MUDANCA', 101, 300, 3.50, 500.00),
('MUDANCA', 301, 500, 3.20, 600.00),
('MUDANCA', 501, NULL, 3.00, 700.00);

-- Add service_type to freights table
ALTER TABLE public.freights ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'CARGA';

-- Create trigger for updated_at
CREATE TRIGGER update_antt_freight_prices_updated_at
BEFORE UPDATE ON public.antt_freight_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();