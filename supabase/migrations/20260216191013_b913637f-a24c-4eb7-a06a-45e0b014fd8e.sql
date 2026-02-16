-- Criar frete de teste PER_KM: Primavera do Leste → Sapezal
INSERT INTO public.freights (
  producer_id, cargo_type, service_type, weight,
  origin_address, origin_city, origin_state, origin_city_id,
  destination_address, destination_city, destination_state, destination_city_id,
  distance_km, minimum_antt_price,
  price, price_per_km, pricing_type,
  required_trucks, accepted_trucks,
  pickup_date, delivery_date,
  urgency, status, visibility_type
) VALUES (
  '5968c470-b7a8-4c53-90cd-68a2b726f5bb',
  'soja', 'CARGA', 30000,
  'Primavera do Leste, MT', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8',
  'Sapezal, MT', 'Sapezal', 'MT', '22f489fa-2fe0-4044-81c2-7c8b6c2db3eb',
  650, 3200,
  6500, 10.00, 'PER_KM',
  1, 0,
  '2026-02-18', '2026-02-20',
  'MEDIUM', 'OPEN', 'ALL'
);