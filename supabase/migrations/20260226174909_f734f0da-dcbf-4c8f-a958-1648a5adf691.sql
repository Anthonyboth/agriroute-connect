
-- Create urban test freights with weight >= 100kg (0.1 ton)
INSERT INTO freights (producer_id, service_type, cargo_type, status, origin_address, destination_address, origin_city, origin_state, destination_city, destination_state, origin_lat, origin_lng, destination_lat, destination_lng, price, weight, distance_km, pickup_date, delivery_date, urgency, required_trucks, accepted_trucks, drivers_assigned)
VALUES
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'GUINCHO', 'Veículo', 'OPEN', 'Rondonópolis/MT - Av. Brasil, 1200', 'Rondonópolis/MT - Av. Lions, 500', 'Rondonópolis', 'MT', 'Rondonópolis', 'MT', -16.4673, -54.6372, -16.4580, -54.6290, 350, 2000, 8, now() + interval '1 day', now() + interval '1 day', 'HIGH', 1, 0, '{}'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'MUDANCA', 'Móveis e Utensílios', 'OPEN', 'Primavera do Leste/MT - Rua Cuiabá, 300', 'Rondonópolis/MT - Rua Goiás, 150', 'Primavera do Leste', 'MT', 'Rondonópolis', 'MT', -15.5600, -54.2960, -16.4673, -54.6372, 1200, 500, 120, now() + interval '2 days', now() + interval '3 days', 'MEDIUM', 1, 0, '{}'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'FRETE_MOTO', 'Pacote Pequeno', 'OPEN', 'Campo Verde/MT - Centro, Av. Principal 500', 'Primavera do Leste/MT - Bairro Norte, Rua 10', 'Campo Verde', 'MT', 'Primavera do Leste', 'MT', -15.5450, -55.1630, -15.5600, -54.2960, 80, 100, 85, now() + interval '1 day', now() + interval '1 day', 'HIGH', 1, 0, '{}'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'GUINCHO', 'Caminhonete', 'OPEN', 'Campo Verde/MT - BR-070 km 230', 'Campo Verde/MT - Oficina Central', 'Campo Verde', 'MT', 'Campo Verde', 'MT', -15.5400, -55.1500, -15.5450, -55.1630, 450, 1500, 5, now(), now(), 'HIGH', 1, 0, '{}'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'MUDANCA', 'Mudança Residencial', 'OPEN', 'Rondonópolis/MT - Vila Aurora, Rua 15', 'Primavera do Leste/MT - Jardim das Flores', 'Rondonópolis', 'MT', 'Primavera do Leste', 'MT', -16.4700, -54.6400, -15.5600, -54.2960, 2500, 800, 130, now() + interval '3 days', now() + interval '4 days', 'LOW', 1, 0, '{}'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'FRETE_MOTO', 'Documentos', 'OPEN', 'Rondonópolis/MT - Centro, Rua Fernando Corrêa', 'Rondonópolis/MT - Bairro Sagrada Família', 'Rondonópolis', 'MT', 'Rondonópolis', 'MT', -16.4650, -54.6350, -16.4750, -54.6450, 150, 100, 4, now(), now(), 'HIGH', 1, 0, '{}');

-- Update OPEN rural freights to have origin_city in driver's cities
UPDATE freights 
SET origin_city = 
  CASE 
    WHEN (EXTRACT(EPOCH FROM created_at)::int % 3) = 0 THEN 'Rondonópolis'
    WHEN (EXTRACT(EPOCH FROM created_at)::int % 3) = 1 THEN 'Primavera do Leste'
    ELSE 'Campo Verde'
  END,
  origin_state = 'MT'
WHERE producer_id = 'a885f432-99a5-41e9-8b07-f0794ba55af4'
  AND service_type = 'CARGA'
  AND status = 'OPEN';
