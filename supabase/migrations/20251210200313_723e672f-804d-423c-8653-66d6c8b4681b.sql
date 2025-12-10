-- Criar tabela para histórico de fotos de veículos (soft delete)
CREATE TABLE public.vehicle_photo_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT DEFAULT 'geral', -- placa, lateral, frontal, traseira, equipamento, geral
  is_visible BOOLEAN DEFAULT true, -- soft delete: false = removida do painel
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  removed_at TIMESTAMPTZ, -- quando foi "removida" (soft delete)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_vehicle_photos_vehicle_id ON vehicle_photo_history(vehicle_id);
CREATE INDEX idx_vehicle_photos_visible ON vehicle_photo_history(vehicle_id, is_visible) WHERE is_visible = true;

-- Habilitar RLS
ALTER TABLE vehicle_photo_history ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver fotos dos seus veículos
CREATE POLICY "Users can view own vehicle photos"
  ON vehicle_photo_history FOR SELECT
  USING (vehicle_id IN (
    SELECT v.id FROM vehicles v
    JOIN profiles p ON p.id = v.driver_id
    WHERE p.user_id = auth.uid()
  ));

-- Política: usuários podem inserir fotos nos seus veículos
CREATE POLICY "Users can insert own vehicle photos"
  ON vehicle_photo_history FOR INSERT
  WITH CHECK (vehicle_id IN (
    SELECT v.id FROM vehicles v
    JOIN profiles p ON p.id = v.driver_id
    WHERE p.user_id = auth.uid()
  ));

-- Política: usuários podem atualizar fotos dos seus veículos (para soft delete)
CREATE POLICY "Users can update own vehicle photos"
  ON vehicle_photo_history FOR UPDATE
  USING (vehicle_id IN (
    SELECT v.id FROM vehicles v
    JOIN profiles p ON p.id = v.driver_id
    WHERE p.user_id = auth.uid()
  ));