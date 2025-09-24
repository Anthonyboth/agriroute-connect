-- Sistema de Localização Inteligente - Fix Functions

-- 1. Dropar funções existentes para permitir recriação com novos tipos
DROP FUNCTION IF EXISTS public.get_freights_in_radius(UUID);
DROP FUNCTION IF EXISTS public.get_service_requests_in_radius(UUID);

-- 2. Criar tabela de cidades para referência automática
CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  ibge_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(name, state)
);

-- Habilitar RLS na tabela cities
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Policy para visualizar cidades (público)
DROP POLICY IF EXISTS "Anyone can view cities" ON public.cities;
CREATE POLICY "Anyone can view cities" ON public.cities FOR SELECT USING (true);

-- Policy para inserção automática de cidades
DROP POLICY IF EXISTS "System can insert cities" ON public.cities;
CREATE POLICY "System can insert cities" ON public.cities FOR INSERT WITH CHECK (true);

-- 3. Adicionar campos obrigatórios de localização às tabelas existentes

-- Adicionar campos à tabela freights se não existirem
ALTER TABLE public.freights 
ADD COLUMN IF NOT EXISTS origin_city TEXT,
ADD COLUMN IF NOT EXISTS origin_state TEXT,
ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC DEFAULT 50,
ADD COLUMN IF NOT EXISTS destination_city TEXT,
ADD COLUMN IF NOT EXISTS destination_state TEXT;

-- Adicionar campos à tabela service_requests se não existirem
ALTER TABLE public.service_requests 
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_state TEXT,
ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC DEFAULT 50;

-- 4. Função para inserir cidade automaticamente quando necessário
CREATE OR REPLACE FUNCTION public.auto_insert_city(
  city_name TEXT,
  state_name TEXT,
  latitude NUMERIC DEFAULT NULL,
  longitude NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  city_id UUID;
BEGIN
  -- Verificar se cidade já existe
  SELECT id INTO city_id 
  FROM cities 
  WHERE LOWER(name) = LOWER(city_name) 
  AND LOWER(state) = LOWER(state_name);
  
  -- Se não existir, inserir nova cidade
  IF city_id IS NULL THEN
    INSERT INTO cities (name, state, lat, lng)
    VALUES (city_name, state_name, latitude, longitude)
    RETURNING id INTO city_id;
  END IF;
  
  RETURN city_id;
END;
$$;