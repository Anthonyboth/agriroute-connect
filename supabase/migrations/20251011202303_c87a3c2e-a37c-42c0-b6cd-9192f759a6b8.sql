-- 1. Criar tabela para taxas ANTT oficiais
CREATE TABLE IF NOT EXISTS antt_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classificação
  table_type TEXT NOT NULL CHECK (table_type IN ('A', 'B', 'C', 'D')),
  cargo_category TEXT NOT NULL,
  axles INTEGER NOT NULL CHECK (axles IN (2,3,4,5,6,7,9)),
  
  -- Coeficientes oficiais da ANTT
  rate_per_km NUMERIC(10,4) NOT NULL,
  fixed_charge NUMERIC(10,2) NOT NULL,
  
  -- Metadados
  diesel_price NUMERIC(10,2) DEFAULT 6.44,
  effective_date DATE DEFAULT '2025-02-07',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(table_type, cargo_category, axles)
);

-- Índices para performance
CREATE INDEX idx_antt_rates_lookup ON antt_rates(cargo_category, axles, table_type);

-- Comentários nas colunas
COMMENT ON TABLE antt_rates IS 'Taxas oficiais ANTT (Portaria Nº 3/2025)';
COMMENT ON COLUMN antt_rates.table_type IS 'A=Padrão, B=Automotor, C=Alto Desempenho, D=Automotor Alto Desempenho';
COMMENT ON COLUMN antt_rates.rate_per_km IS 'CCD - Coeficiente de Deslocamento (R$/km)';
COMMENT ON COLUMN antt_rates.fixed_charge IS 'CC - Carga e Descarga (R$ fixo)';

-- 2. Adicionar campos aos fretes
ALTER TABLE freights 
ADD COLUMN IF NOT EXISTS vehicle_axles_required INTEGER CHECK (vehicle_axles_required IN (2,3,4,5,6,7,9)),
ADD COLUMN IF NOT EXISTS high_performance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cargo_category_antt TEXT;

-- 3. Adicionar campos aos veículos
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS axle_count INTEGER CHECK (axle_count IN (2,3,4,5,6,7,9)),
ADD COLUMN IF NOT EXISTS high_performance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS primary_identification TEXT DEFAULT 'type' CHECK (primary_identification IN ('type', 'axles'));

-- 4. Popular TABELA A (Carga Lotação - PADRÃO)
INSERT INTO antt_rates (table_type, cargo_category, axles, rate_per_km, fixed_charge) VALUES
-- Granel sólido (grãos, fertilizantes)
('A', 'Granel sólido', 2, 3.7421, 413.06),
('A', 'Granel sólido', 3, 4.7423, 503.16),
('A', 'Granel sólido', 4, 5.4133, 547.19),
('A', 'Granel sólido', 5, 5.7673, 503.06),
('A', 'Granel sólido', 6, 6.4431, 534.98),
('A', 'Granel sólido', 7, 7.3863, 729.94),
('A', 'Granel sólido', 9, 8.3346, 782.50),

-- Granel líquido (combustível)
('A', 'Granel líquido', 2, 3.7975, 420.01),
('A', 'Granel líquido', 3, 4.8140, 514.58),
('A', 'Granel líquido', 4, 5.6223, 588.12),
('A', 'Granel líquido', 5, 5.9126, 526.44),
('A', 'Granel líquido', 6, 6.5789, 555.76),
('A', 'Granel líquido', 7, 7.5406, 755.80),
('A', 'Granel líquido', 9, 8.4986, 811.04),

-- Frigorificada ou Aquecida
('A', 'Frigorificada ou Aquecida', 2, 4.3949, 470.77),
('A', 'Frigorificada ou Aquecida', 3, 5.5382, 563.73),
('A', 'Frigorificada ou Aquecida', 4, 6.4295, 641.71),
('A', 'Frigorificada ou Aquecida', 5, 6.8793, 597.75),
('A', 'Frigorificada ou Aquecida', 6, 7.6390, 623.07),
('A', 'Frigorificada ou Aquecida', 7, 8.8913, 903.05),
('A', 'Frigorificada ou Aquecida', 9, 9.9944, 961.91),

-- Conteinerizada
('A', 'Conteinerizada', 3, 4.8151, 523.18),
('A', 'Conteinerizada', 4, 5.3495, 529.65),
('A', 'Conteinerizada', 5, 5.6974, 483.84),
('A', 'Conteinerizada', 6, 6.3669, 514.02),
('A', 'Conteinerizada', 7, 7.4249, 740.55),
('A', 'Conteinerizada', 9, 8.2864, 769.24),

-- Carga Geral
('A', 'Carga Geral', 2, 3.7116, 404.67),
('A', 'Carga Geral', 3, 4.7063, 493.25),
('A', 'Carga Geral', 4, 5.3919, 541.33),
('A', 'Carga Geral', 5, 5.7491, 498.04),
('A', 'Carga Geral', 6, 6.4328, 532.13),
('A', 'Carga Geral', 7, 7.3819, 728.74),
('A', 'Carga Geral', 9, 8.3597, 789.41),

-- Neogranel
('A', 'Neogranel', 2, 3.3596, 404.67),
('A', 'Neogranel', 3, 4.7056, 493.06),
('A', 'Neogranel', 4, 5.4037, 544.57),
('A', 'Neogranel', 5, 5.7402, 495.60),
('A', 'Neogranel', 6, 6.4258, 530.22),
('A', 'Neogranel', 7, 7.4215, 739.60),
('A', 'Neogranel', 9, 8.3528, 787.50),

-- Perigosa (granel sólido)
('A', 'Perigosa (granel sólido)', 2, 4.4451, 547.62),
('A', 'Perigosa (granel sólido)', 3, 5.4453, 637.73),
('A', 'Perigosa (granel sólido)', 4, 6.1625, 689.83),
('A', 'Perigosa (granel sólido)', 5, 6.5166, 645.70),
('A', 'Perigosa (granel sólido)', 6, 7.1923, 677.62),
('A', 'Perigosa (granel sólido)', 7, 8.1635, 880.27),
('A', 'Perigosa (granel sólido)', 9, 9.1412, 940.93),

-- Perigosa (granel líquido)
('A', 'Perigosa (granel líquido)', 2, 4.5121, 566.04),
('A', 'Perigosa (granel líquido)', 3, 5.5286, 660.62),
('A', 'Perigosa (granel líquido)', 4, 6.3530, 742.24),
('A', 'Perigosa (granel líquido)', 5, 6.6433, 680.55),
('A', 'Perigosa (granel líquido)', 6, 7.3096, 709.88),
('A', 'Perigosa (granel líquido)', 7, 8.2993, 917.61),
('A', 'Perigosa (granel líquido)', 9, 9.2867, 980.95),

-- Perigosa (carga geral)
('A', 'Perigosa (carga geral)', 2, 4.0488, 492.80),
('A', 'Perigosa (carga geral)', 3, 5.0436, 581.37),
('A', 'Perigosa (carga geral)', 4, 5.7754, 637.53),
('A', 'Perigosa (carga geral)', 5, 6.1326, 594.24),
('A', 'Perigosa (carga geral)', 6, 6.8162, 628.33),
('A', 'Perigosa (carga geral)', 7, 7.7934, 832.63),
('A', 'Perigosa (carga geral)', 9, 8.8006, 901.40),

-- Carga Granel Pressurizada
('A', 'Carga Granel Pressurizada', 5, 6.0407, 578.22),
('A', 'Carga Granel Pressurizada', 6, 6.7779, 627.03),
('A', 'Carga Granel Pressurizada', 9, 8.7789, 904.69);

-- 5. Popular TABELA C (Alto Desempenho)
INSERT INTO antt_rates (table_type, cargo_category, axles, rate_per_km, fixed_charge) VALUES
-- Granel sólido (Alto Desempenho)
('C', 'Granel sólido', 2, 3.1786, 154.94),
('C', 'Granel sólido', 3, 3.9689, 174.36),
('C', 'Granel sólido', 4, 4.6076, 195.46),
('C', 'Granel sólido', 5, 5.1855, 205.91),
('C', 'Granel sólido', 6, 5.8057, 215.89),
('C', 'Granel sólido', 7, 6.2217, 245.88),
('C', 'Granel sólido', 9, 7.1180, 268.84),

-- Carga Geral (Alto Desempenho)
('C', 'Carga Geral', 2, 3.1677, 153.14),
('C', 'Carga Geral', 3, 3.9559, 172.22),
('C', 'Carga Geral', 4, 4.5999, 194.19),
('C', 'Carga Geral', 5, 5.1790, 204.83),
('C', 'Carga Geral', 6, 5.8020, 215.27),
('C', 'Carga Geral', 7, 6.2201, 245.62),
('C', 'Carga Geral', 9, 7.1270, 270.33),

-- Perigosa (carga geral) Alto Desempenho
('C', 'Perigosa (carga geral)', 2, 3.3965, 188.12),
('C', 'Perigosa (carga geral)', 3, 4.1848, 207.21),
('C', 'Perigosa (carga geral)', 4, 4.8773, 234.40),
('C', 'Perigosa (carga geral)', 5, 5.4563, 245.04),
('C', 'Perigosa (carga geral)', 6, 6.0793, 255.48),
('C', 'Perigosa (carga geral)', 7, 6.5276, 290.80),
('C', 'Perigosa (carga geral)', 9, 7.4662, 320.75);

-- Enable RLS
ALTER TABLE antt_rates ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can view
CREATE POLICY "Authenticated users can view ANTT rates"
ON antt_rates FOR SELECT
TO authenticated
USING (true);

-- Policy: service role can manage
CREATE POLICY "Service role can manage ANTT rates"
ON antt_rates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);