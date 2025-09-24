-- Inserir área de serviço exemplo para o prestador/motorista dos logs
-- A coluna geom será calculada automaticamente pelo trigger

INSERT INTO driver_service_areas (
  driver_id,
  city_name,
  state,
  lat,
  lng,
  radius_km,
  is_active
) VALUES (
  '95bad341-4546-4d32-b711-95d45f54c5b6',
  'Primavera do Leste',
  'MT',
  -15.568857592749708,
  -54.30945044950954,
  100,
  true
);

-- Inserir segunda área baseada em Cuiabá
INSERT INTO driver_service_areas (
  driver_id,
  city_name,
  state,
  lat,
  lng,
  radius_km,
  is_active
) VALUES (
  '95bad341-4546-4d32-b711-95d45f54c5b6',
  'Cuiabá',
  'MT',
  -15.601,
  -56.097,
  80,
  true
);

-- Adicionar alguns fretes de exemplo próximos para teste
INSERT INTO freights (
  producer_id,
  cargo_type,
  weight,
  origin_address,
  destination_address,
  origin_city,
  origin_state,
  destination_city,
  destination_state,
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
  pickup_date,
  delivery_date,
  price,
  status,
  urgency,
  service_type
) VALUES
(
  '95bad341-4546-4d32-b711-95d45f54c5b6', -- mesmo user para teste
  'GRAO_SOJA',
  30,
  'Fazenda Santa Helena, Primavera do Leste, MT',
  'Terminal de Grãos, Rondonópolis, MT',
  'Primavera do Leste',
  'MT',
  'Rondonópolis',
  'MT',
  -15.555,
  -54.295,
  -16.470,
  -54.635,
  CURRENT_DATE + INTERVAL '2 days',
  CURRENT_DATE + INTERVAL '5 days',
  8500.00,
  'OPEN',
  'MEDIUM',
  'CARGA'
),
(
  '95bad341-4546-4d32-b711-95d45f54c5b6',
  'MILHO',
  25,
  'Fazenda Esperança, Campo Verde, MT',
  'Porto de Santarém, PA',
  'Campo Verde',
  'MT',
  'Santarém',
  'PA',
  -15.541,
  -55.166,
  -2.430,
  -54.708,
  CURRENT_DATE + INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '8 days',
  15200.00,
  'OPEN',
  'HIGH',
  'CARGA'
);