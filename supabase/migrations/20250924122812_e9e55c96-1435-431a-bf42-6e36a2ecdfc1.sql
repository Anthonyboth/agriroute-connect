-- Corrigir inconsistências nos tipos de serviço e criar solicitação de teste

-- 1. Padronizar tipos de serviço na tabela service_provider_areas
UPDATE service_provider_areas 
SET service_types = ARRAY['BORRACHEIRO', 'ELETRICISTA_AUTOMOTIVO', 'MECANICO', 'GUINCHO']
WHERE provider_id = '95bad341-4546-4d32-b711-95d45f54c5b6';

-- 2. Criar uma nova solicitação de teste próxima ao prestador em Primavera do Leste
INSERT INTO service_requests (
  client_id,
  service_type,
  location_address,
  location_lat,
  location_lng,
  problem_description,
  contact_phone,
  urgency,
  estimated_price,
  status,
  service_radius_km
) VALUES (
  'b35a5938-638b-49f7-9af1-364e9c5bbe28',
  'BORRACHEIRO',
  'Rua das Palmeiras, 456, Primavera do Leste, MT',
  -15.556100,
  -54.296700,
  'Pneu furado no centro da cidade, preciso de atendimento urgente',
  '66999887766',
  'HIGH',
  120.00,
  'OPEN',
  50
);

-- 3. Criar mais uma solicitação de eletricista automotivo
INSERT INTO service_requests (
  client_id,
  service_type,
  location_address,
  location_lat,
  location_lng,
  problem_description,
  contact_phone,
  urgency,
  estimated_price,
  status,
  service_radius_km
) VALUES (
  'b35a5938-638b-49f7-9af1-364e9c5bbe28',
  'ELETRICISTA_AUTOMOTIVO',
  'Avenida Brasil, 123, Primavera do Leste, MT',
  -15.565000,
  -54.305000,
  'Problemas elétricos no caminhão, alternador não funciona',
  '66988776655',
  'MEDIUM',
  250.00,
  'OPEN',
  50
);