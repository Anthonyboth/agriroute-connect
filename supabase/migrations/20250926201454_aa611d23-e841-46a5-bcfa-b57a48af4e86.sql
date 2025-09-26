-- Inserir registro na service_providers para corrigir erro "provider not registered"
INSERT INTO public.service_providers (
  profile_id,
  service_type,
  service_radius_km,
  service_area_cities,
  emergency_service,
  works_weekends,
  works_holidays
)
VALUES (
  '950a8ca0-db8c-4f8c-9a21-80917dedf690',
  'CHAVEIRO',
  50,
  ARRAY['Primavera do Leste, MT'],
  true,
  true,  
  true
);