-- Criar tabela para áreas de produtores
CREATE TABLE producer_service_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  city_name TEXT NOT NULL,
  state TEXT,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  radius_km NUMERIC NOT NULL DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  geom GEOMETRY(POINT, 4326),
  
  CONSTRAINT fk_producer_id FOREIGN KEY (producer_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX idx_producer_service_areas_producer_id ON producer_service_areas(producer_id);
CREATE INDEX idx_producer_service_areas_active ON producer_service_areas(is_active);
CREATE INDEX idx_producer_service_areas_geom ON producer_service_areas USING GIST(geom);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_producer_service_areas_updated_at
  BEFORE UPDATE ON producer_service_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para calcular geometry
CREATE OR REPLACE FUNCTION update_producer_service_area_geom()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar a geometria quando lat/lng mudam
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER producer_service_areas_geom_trigger
  BEFORE INSERT OR UPDATE ON producer_service_areas
  FOR EACH ROW
  EXECUTE FUNCTION update_producer_service_area_geom();

-- RLS policies
ALTER TABLE producer_service_areas ENABLE ROW LEVEL SECURITY;

-- Produtores podem gerenciar suas próprias áreas
CREATE POLICY "Producers can manage their own service areas"
ON producer_service_areas
FOR ALL
USING (producer_id IN (
  SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
))
WITH CHECK (producer_id IN (
  SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
));

-- Usuários autenticados podem ver áreas ativas
CREATE POLICY "Authenticated users can view active service areas"
ON producer_service_areas
FOR SELECT
USING (is_active = true);