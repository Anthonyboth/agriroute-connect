
-- =============================================================
-- TEST DATA: Freights and Service Requests for E2E match validation
-- =============================================================

-- FREIGHTS (11 total: 8 OPEN within/outside radius, 2 different types, 1 cancelled)
INSERT INTO freights (producer_id, cargo_type, weight, origin_address, origin_city, origin_state, origin_city_id, origin_lat, origin_lng, destination_address, destination_city, destination_state, destination_city_id, distance_km, price, pickup_date, delivery_date, service_type, urgency, status) VALUES
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Soja', 25000, 'Rod BR-364 km 45', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', -16.4673, -54.6372, 'Porto Seco', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 108, 3500, NOW() + interval '2 days', NOW() + interval '4 days', 'CARGA', 'HIGH', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Milho', 30000, 'CPA Cuiabá', 'Cuiabá', 'MT', 'b5a91d94-7472-420b-97df-11d39672eca0', -15.6014, -56.0979, 'Armazém', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', 200, 5000, NOW() + interval '1 day', NOW() + interval '3 days', 'CARGA', 'MEDIUM', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Algodão', 20000, 'Fazenda Esperança', 'Paranatinga', 'MT', '0780bf65-6853-43c7-bccc-a6931c46616d', -14.4281, -54.0489, 'Terminal', 'Cuiabá', 'MT', 'b5a91d94-7472-420b-97df-11d39672eca0', 350, 6000, NOW() + interval '3 days', NOW() + interval '5 days', 'CARGA', 'LOW', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Fertilizante', 15000, 'Coop Nova Mutum', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', -13.8361, -56.0831, 'Fazenda', 'Sorriso', 'MT', '0a3e0bf1-9562-41c2-bbf3-1ffd80f47869', 120, 2800, NOW() + interval '1 day', NOW() + interval '2 days', 'CARGA', 'HIGH', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Defensivos', 5000, 'Agrocenter', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', -15.5561, -54.2958, 'Fazenda Boa Vista', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 30, 800, NOW() + interval '1 day', NOW() + interval '1 day', 'CARGA', 'HIGH', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Adubo', 18000, 'Armazém', 'Novo São Joaquim', 'MT', 'a2aadd7b-35dc-40ac-83ac-bcd12c0dc1d7', -14.8556, -53.0147, 'Fazenda', 'Canarana', 'MT', 'd23f4c9e-82ac-4059-aa6a-b67cb7785d7f', 180, 4200, NOW() + interval '2 days', NOW() + interval '4 days', 'CARGA', 'MEDIUM', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Madeira', 40000, 'Madeireira Sinop', 'Sinop', 'MT', '34cc76dd-0659-46ac-aa2e-33a846c9b1d7', -11.8608, -55.5094, 'Indústria', 'Cuiabá', 'MT', 'b5a91d94-7472-420b-97df-11d39672eca0', 500, 8000, NOW() + interval '2 days', NOW() + interval '5 days', 'CARGA', 'MEDIUM', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Gado', 10000, 'Curral', 'Campo Grande', 'MS', '237f89ea-0199-4d77-a013-c10312259f0d', -20.4697, -54.6201, 'Frigorífico', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', 400, 7000, NOW() + interval '3 days', NOW() + interval '6 days', 'CARGA', 'LOW', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Container', 20000, 'Porto Suape', 'Suape', 'PE', '7cf58238-5906-4b17-a412-5fd3207d4b4e', -8.3917, -35.0064, 'Terminal', 'Recife', 'PE', NULL, 50, 2000, NOW() + interval '5 days', NOW() + interval '7 days', 'CARGA', 'LOW', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Veículo', 2000, 'Rod BR-364', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', -16.4673, -54.6372, 'Oficina', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 108, 1200, NOW() + interval '1 day', NOW() + interval '1 day', 'GUINCHO', 'HIGH', 'OPEN'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Móveis', 3000, 'Centro Cuiabá', 'Cuiabá', 'MT', 'b5a91d94-7472-420b-97df-11d39672eca0', -15.6014, -56.0979, 'Casa Nova', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', 200, 2500, NOW() + interval '2 days', NOW() + interval '3 days', 'MUDANCA', 'MEDIUM', 'OPEN');

-- SERVICE REQUESTS (8 total, with contact_phone filled)
INSERT INTO service_requests (client_id, service_type, location_address, city_name, state, city_id, location_lat, location_lng, problem_description, urgency, status, contact_phone, contact_name) VALUES
('04924959-d415-4c25-9ef3-209dc29ed30a', 'AGRONOMO', 'Fazenda Sol Nascente', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', -16.4673, -54.6372, 'Laudo técnico para plantio de soja', 'HIGH', 'OPEN', '66999990001', 'Produtor Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'ANALISE_SOLO', 'Fazenda Boa Esperança', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', -15.5561, -54.2958, 'Análise completa do solo para safrinha', 'MEDIUM', 'OPEN', '66999990002', 'Produtor Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'BORRACHEIRO', 'Rod MT-130 km 80', 'Paranatinga', 'MT', '0780bf65-6853-43c7-bccc-a6931c46616d', -14.4281, -54.0489, 'Pneu furado caminhão na estrada', 'HIGH', 'OPEN', '66999990003', 'Motorista Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'MECANICO', 'Oficina Central', 'Rondonópolis', 'MT', 'a88c3b82-3a3d-4fde-bb08-fd1c7c90757d', -16.4673, -54.6372, 'Problema no motor do trator', 'MEDIUM', 'OPEN', '66999990004', 'Produtor Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'AGRONOMO', 'Fazenda Norte', 'Sinop', 'MT', '34cc76dd-0659-46ac-aa2e-33a846c9b1d7', -11.8608, -55.5094, 'Consultoria agrícola', 'LOW', 'OPEN', '66999990005', 'Produtor Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'AGRONOMO', 'Porto Suape', 'Suape', 'PE', '7cf58238-5906-4b17-a412-5fd3207d4b4e', -8.3917, -35.0064, 'Consultoria para exportação', 'LOW', 'OPEN', '66999990006', 'Produtor Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'ARMAZENAGEM', 'Armazém Central', 'Cuiabá', 'MT', 'b5a91d94-7472-420b-97df-11d39672eca0', -15.6014, -56.0979, 'Preciso de armazenagem para 500 toneladas', 'MEDIUM', 'OPEN', '66999990007', 'Produtor Teste'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'CARGA', 'Terminal', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', -15.5561, -54.2958, 'Carga já entregue', 'LOW', 'COMPLETED', '66999990008', 'Produtor Teste');

-- Clear expired exposures for clean test
DELETE FROM match_exposures WHERE expires_at < NOW();
