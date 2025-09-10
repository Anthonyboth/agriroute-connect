-- Adicionar campos de agendamento na tabela freights
ALTER TABLE freights ADD COLUMN IF NOT EXISTS scheduled_date date;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS is_scheduled boolean DEFAULT false;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS flexible_dates boolean DEFAULT false;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS date_range_start date;
ALTER TABLE freights ADD COLUMN IF NOT EXISTS date_range_end date;

-- Criar tabela para disponibilidade dos motoristas
CREATE TABLE IF NOT EXISTS driver_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL,
  available_date date NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  notes text,
  available_until_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(driver_id, available_date, city)
);

-- Enable RLS on driver_availability
ALTER TABLE driver_availability ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para driver_availability
CREATE POLICY "Drivers can insert their own availability"
ON driver_availability FOR INSERT
WITH CHECK (driver_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA'
));

CREATE POLICY "Drivers can update their own availability"
ON driver_availability FOR UPDATE
USING (driver_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Drivers can delete their own availability"
ON driver_availability FOR DELETE
USING (driver_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can view driver availability"
ON driver_availability FOR SELECT
USING (true);

-- Criar tabela para propostas com datas flexíveis
CREATE TABLE IF NOT EXISTS flexible_freight_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  proposed_date date NOT NULL,
  original_date date NOT NULL,
  days_difference integer NOT NULL,
  proposed_price numeric,
  message text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on flexible_freight_proposals
ALTER TABLE flexible_freight_proposals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para flexible_freight_proposals
CREATE POLICY "Drivers can create flexible proposals"
ON flexible_freight_proposals FOR INSERT
WITH CHECK (driver_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'MOTORISTA'
));

CREATE POLICY "Users can view proposals for their freights"
ON flexible_freight_proposals FOR SELECT
USING (
  freight_id IN (
    SELECT id FROM freights WHERE producer_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  ) OR 
  driver_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ) OR
  is_admin()
);

CREATE POLICY "Producers can update proposal status"
ON flexible_freight_proposals FOR UPDATE
USING (
  freight_id IN (
    SELECT id FROM freights WHERE producer_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_driver_availability_updated_at
  BEFORE UPDATE ON driver_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flexible_freight_proposals_updated_at
  BEFORE UPDATE ON flexible_freight_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para buscar fretes por localização e data
CREATE OR REPLACE FUNCTION get_scheduled_freights_by_location_and_date(
  p_city text,
  p_date date,
  p_days_range integer DEFAULT 3
)
RETURNS TABLE (
  freight_id uuid,
  producer_name text,
  origin_address text,
  destination_address text,
  scheduled_date date,
  flexible_dates boolean,
  date_range_start date,
  date_range_end date,
  weight numeric,
  price numeric,
  cargo_type text,
  distance_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    p.full_name,
    f.origin_address,
    f.destination_address,
    f.scheduled_date,
    f.flexible_dates,
    f.date_range_start,
    f.date_range_end,
    f.weight,
    f.price,
    f.cargo_type,
    f.distance_km
  FROM freights f
  JOIN profiles p ON f.producer_id = p.id
  WHERE 
    f.is_scheduled = true 
    AND f.status = 'OPEN'
    AND (
      -- Fretes na cidade de origem
      LOWER(f.origin_address) LIKE '%' || LOWER(p_city) || '%'
      OR
      -- Fretes na cidade de destino
      LOWER(f.destination_address) LIKE '%' || LOWER(p_city) || '%'
    )
    AND (
      -- Data exata
      f.scheduled_date = p_date
      OR
      -- Fretes com flexibilidade de datas
      (f.flexible_dates = true AND f.scheduled_date BETWEEN (p_date - p_days_range) AND (p_date + p_days_range))
      OR
      -- Fretes dentro do range definido pelo produtor
      (f.date_range_start IS NOT NULL AND p_date BETWEEN f.date_range_start AND f.date_range_end)
    );
END;
$$;