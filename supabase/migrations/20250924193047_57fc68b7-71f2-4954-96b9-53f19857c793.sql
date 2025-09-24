-- Criar solicitações de serviços de teste para Primavera do Leste
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
  status, 
  created_at
) VALUES 
-- Solicitação 1: Mecânico urgente
(
  '02f0f1a8-c0c9-49c9-bb61-9a41ca82fec7',
  'MECANICO',
  'Rua Central 100, Primavera do Leste, MT',
  -15.5561,
  -54.2967,
  'Problema no motor, preciso de mecânico urgente',
  'HIGH',
  '66999888777',
  250.00,
  'OPEN',
  NOW()
),
-- Solicitação 2: Borracheiro
(
  '02f0f1a8-c0c9-49c9-bb61-9a41ca82fec7',
  'BORRACHEIRO',
  'Avenida Brasil 250, Primavera do Leste, MT',
  -15.5580,
  -54.2980,
  'Pneu furado na estrada, preciso de borracheiro',
  'MEDIUM',
  '66998877665',
  120.00,
  'OPEN',
  NOW()
),
-- Solicitação 3: Guincho
(
  '02f0f1a8-c0c9-49c9-bb61-9a41ca82fec7',
  'GUINCHO',
  'BR-163, KM 30, Primavera do Leste, MT',
  -15.5700,
  -54.3100,
  'Caminhão atolado, necessário guincho',
  'HIGH',
  '66987654321',
  400.00,
  'OPEN',
  NOW()
),
-- Solicitação 4: Elétrica
(
  '02f0f1a8-c0c9-49c9-bb61-9a41ca82fec7',
  'ELETRICA',
  'Rua das Flores 45, Primavera do Leste, MT',
  -15.5520,
  -54.2900,
  'Problema elétrico no caminhão, bateria descarregada',
  'MEDIUM',
  '66976543210',
  180.00,
  'OPEN',
  NOW()
),
-- Solicitação 5: Carga
(
  '02f0f1a8-c0c9-49c9-bb61-9a41ca82fec7',
  'CARGA',
  'Fazenda São João, Primavera do Leste, MT',
  -15.5800,
  -54.2800,
  'Necessário transporte de carga da fazenda para o armazém',
  'LOW',
  '66965432109',
  800.00,
  'OPEN',
  NOW()
);