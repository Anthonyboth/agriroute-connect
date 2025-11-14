-- Adicionar campos CEP nas tabelas principais

-- Tabela cities: adicionar CEP
ALTER TABLE cities 
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS zip_code_ranges JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cities_zip_code ON cities(zip_code);
CREATE INDEX IF NOT EXISTS idx_cities_zip_code_ranges ON cities USING GIN(zip_code_ranges);

COMMENT ON COLUMN cities.zip_code IS 'CEP principal da cidade (código base)';
COMMENT ON COLUMN cities.zip_code_ranges IS 'Array de faixas de CEP: [{"start": "78850-000", "end": "78859-999"}]';

-- Tabela freights: adicionar CEPs de origem e destino
ALTER TABLE freights 
ADD COLUMN IF NOT EXISTS origin_zip_code TEXT,
ADD COLUMN IF NOT EXISTS destination_zip_code TEXT;

CREATE INDEX IF NOT EXISTS idx_freights_origin_zip ON freights(origin_zip_code);
CREATE INDEX IF NOT EXISTS idx_freights_destination_zip ON freights(destination_zip_code);

-- Tabela driver_availability: adicionar CEP
ALTER TABLE driver_availability 
ADD COLUMN IF NOT EXISTS zip_code TEXT;

CREATE INDEX IF NOT EXISTS idx_driver_availability_zip ON driver_availability(zip_code);

-- Tabela driver_service_areas: adicionar CEP
ALTER TABLE driver_service_areas 
ADD COLUMN IF NOT EXISTS zip_code TEXT;

CREATE INDEX IF NOT EXISTS idx_driver_service_areas_zip ON driver_service_areas(zip_code);

-- Tabela de cache para consultas de CEP
CREATE TABLE IF NOT EXISTS zip_code_cache (
  zip_code TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  state TEXT NOT NULL,
  neighborhood TEXT,
  street TEXT,
  city_id UUID REFERENCES cities(id),
  lat NUMERIC,
  lng NUMERIC,
  source TEXT NOT NULL CHECK (source IN ('viacep', 'brasilapi', 'manual')),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zip_code_cache_city_id ON zip_code_cache(city_id);
CREATE INDEX IF NOT EXISTS idx_zip_code_cache_state ON zip_code_cache(state);
CREATE INDEX IF NOT EXISTS idx_zip_code_cache_expires ON zip_code_cache(expires_at);

-- RLS Policies
ALTER TABLE zip_code_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cache público para leitura" ON zip_code_cache;
CREATE POLICY "Cache público para leitura"
  ON zip_code_cache FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Sistema pode gerenciar cache" ON zip_code_cache;
CREATE POLICY "Sistema pode gerenciar cache"
  ON zip_code_cache FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Função para limpar cache expirado
CREATE OR REPLACE FUNCTION clean_expired_zip_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM zip_code_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar cidade por CEP no cache
CREATE OR REPLACE FUNCTION search_city_by_zip(p_zip_code TEXT)
RETURNS TABLE(
  city_id UUID,
  city_name TEXT,
  state TEXT,
  neighborhood TEXT,
  street TEXT,
  lat NUMERIC,
  lng NUMERIC,
  source TEXT,
  from_cache BOOLEAN
) AS $$
BEGIN
  -- Normalizar CEP (remover traços e espaços)
  p_zip_code := REGEXP_REPLACE(p_zip_code, '[^0-9]', '', 'g');
  
  -- Buscar no cache
  RETURN QUERY
  SELECT 
    zc.city_id,
    zc.city_name,
    zc.state,
    zc.neighborhood,
    zc.street,
    zc.lat,
    zc.lng,
    zc.source,
    true as from_cache
  FROM zip_code_cache zc
  WHERE zc.zip_code = p_zip_code
    AND zc.expires_at > NOW()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para salvar CEP no cache
CREATE OR REPLACE FUNCTION save_zip_to_cache(
  p_zip_code TEXT,
  p_city_name TEXT,
  p_state TEXT,
  p_neighborhood TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_city_id UUID DEFAULT NULL,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_source TEXT DEFAULT 'viacep'
)
RETURNS void AS $$
BEGIN
  -- Normalizar CEP
  p_zip_code := REGEXP_REPLACE(p_zip_code, '[^0-9]', '', 'g');
  
  INSERT INTO zip_code_cache (
    zip_code, city_name, state, neighborhood, street,
    city_id, lat, lng, source, last_updated, expires_at
  ) VALUES (
    p_zip_code,
    p_city_name,
    UPPER(p_state),
    p_neighborhood,
    p_street,
    p_city_id,
    p_lat,
    p_lng,
    p_source,
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (zip_code) DO UPDATE SET
    city_name = EXCLUDED.city_name,
    state = EXCLUDED.state,
    neighborhood = EXCLUDED.neighborhood,
    street = EXCLUDED.street,
    city_id = EXCLUDED.city_id,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    source = EXCLUDED.source,
    last_updated = NOW(),
    expires_at = NOW() + INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;