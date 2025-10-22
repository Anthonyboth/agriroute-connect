-- Dados de teste para validar correção RLS

-- Criar fretes OPEN para motoristas
INSERT INTO freights (
  producer_id,
  origin_address,
  destination_address,
  origin_city,
  destination_city,
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
  cargo_type,
  weight,
  price,
  pickup_date,
  delivery_date,
  status,
  vehicle_type_required,
  required_trucks,
  accepted_trucks,
  urgency
)
SELECT 
  (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
  'Fazenda São João - Primavera do Leste, MT',
  'Armazém Central - Cuiabá, MT',
  'Primavera do Leste, MT',
  'Cuiabá, MT',
  -15.5567,
  -54.2957,
  -15.6014,
  -56.0979,
  'Soja',
  30.0 + (series * 5),
  1500.00 + (series * 100),
  (CURRENT_DATE + INTERVAL '2 days')::date,
  (CURRENT_DATE + INTERVAL '5 days')::date,
  'OPEN',
  'TRUCK',
  1,
  0,
  'MEDIUM'
FROM generate_series(1, 2) AS series
WHERE (SELECT COUNT(*) FROM freights WHERE status = 'OPEN') < 5;

-- Criar service_requests para prestadores
INSERT INTO service_requests (
  client_id,
  service_type,
  status,
  location_address,
  location_city,
  location_lat,
  location_lng,
  problem_description,
  contact_phone,
  estimated_price,
  urgency
)
SELECT * FROM (
  VALUES
    (
      (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
      'MECANICA',
      'OPEN',
      'Primavera do Leste, MT',
      'Primavera do Leste',
      -15.5567,
      -54.2957,
      '🔧 Teste: Manutenção preventiva de veículo',
      '(66) 9999-9999',
      250.00,
      'MEDIUM'
    ),
    (
      (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
      'ELETRICISTA',
      'OPEN',
      'Cuiabá, MT',
      'Cuiabá',
      -15.6014,
      -56.0979,
      '⚡ Teste: Instalação elétrica rural',
      '(65) 9999-9999',
      180.00,
      'MEDIUM'
    ),
    (
      (SELECT id FROM profiles WHERE role = 'PRODUTOR' LIMIT 1),
      'LAVAGEM',
      'OPEN',
      'Lucas do Rio Verde, MT',
      'Lucas do Rio Verde',
      -13.0535,
      -55.9086,
      '🚿 Teste: Lavagem de veículos',
      '(65) 9888-8888',
      80.00,
      'LOW'
    )
) AS new_services(client_id, service_type, status, location_address, location_city, location_lat, location_lng, problem_description, contact_phone, estimated_price, urgency)
WHERE (SELECT COUNT(*) FROM service_requests WHERE status = 'OPEN' AND service_type IN ('MECANICA', 'ELETRICISTA', 'LAVAGEM')) < 3;