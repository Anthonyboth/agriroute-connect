-- Inserir alguns service_requests de exemplo para testes
INSERT INTO service_requests (
  client_id,
  service_type,
  location_address,
  location_lat,
  location_lng,
  problem_description,
  urgency,
  contact_phone,
  estimated_price,
  status
) VALUES 
-- Request em Primavera do Leste (próximo ao prestador)
(
  'b35a5938-638b-49f7-9af1-364e9c5bbe28'::uuid,
  'MECANICO',
  'Rua das Palmeiras, 123, Primavera do Leste, MT',
  -15.5561,
  -54.2967,
  'Caminhão com problema no motor, necessário mecânico com urgência',
  'HIGH',
  '66999887766',
  500.00,
  'OPEN'
),
-- Request em Cuiabá (a cerca de 100km)
(
  'b35a5938-638b-49f7-9af1-364e9c5bbe28'::uuid,
  'GUINCHO',
  'Avenida Getúlio Vargas, 456, Cuiabá, MT',
  -15.6014,
  -56.0979,
  'Caminhão atolado, necessário guincho',
  'MEDIUM',
  '65987654321',
  300.00,
  'OPEN'
),
-- Request em Rondonópolis (a cerca de 150km)
(
  'b35a5938-638b-49f7-9af1-364e9c5bbe28'::uuid,
  'BORRACHEIRO',
  'BR-163, KM 45, Rondonópolis, MT',
  -16.4708,
  -54.6367,
  'Pneu furado na estrada, preciso de borracheiro',
  'HIGH',
  '66988776655',
  150.00,
  'OPEN'
),
-- Request muito distante (Campo Grande - fora do raio)
(
  'b35a5938-638b-49f7-9af1-364e9c5bbe28'::uuid,
  'AUTO_ELETRICA',
  'Rua 14 de Julho, 789, Campo Grande, MS',
  -20.4486,
  -54.6295,
  'Problema elétrico no caminhão, bateria não carrega',
  'LOW',
  '67999123456',
  200.00,
  'OPEN'
);

-- Atualizar o perfil do prestador com coordenadas base de Primavera do Leste
UPDATE profiles 
SET 
  base_city_name = 'Primavera do Leste',
  base_state = 'MT',
  base_lat = -15.5561,
  base_lng = -54.2967,
  location_enabled = true
WHERE id = 'b35a5938-638b-49f7-9af1-364e9c5bbe28';