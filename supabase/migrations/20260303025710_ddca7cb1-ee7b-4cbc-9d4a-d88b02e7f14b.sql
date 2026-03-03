
-- =============================================
-- DADOS DE TESTE: FRETES
-- =============================================

-- Produtores: fretes rurais (CARGA, CARGA_AGRICOLA, CARGA_GRANEL, TRANSPORTE_ANIMAIS, TRANSPORTE_MAQUINARIO)
INSERT INTO freights (producer_id, cargo_type, weight, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, distance_km, price, price_per_km, pricing_type, pickup_date, delivery_date, service_type, origin_city, origin_state, origin_city_id, destination_city, destination_state, destination_city_id, required_trucks, urgency) VALUES
-- Produtor 1: Alex Alcides
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Soja', 30000, 'Fazenda Santa Helena, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Armazém Central, Nova Mutum - MT', -13.8361, -56.0831, 95, 8550, 90, 'PER_KM', now() + interval '2 days', now() + interval '4 days', 'CARGA_AGRICOLA', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 2, 'MEDIUM'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'Milho', 25000, 'Silo Fazenda Progresso, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Porto Seco, Primavera do Leste - MT', -15.5561, -54.2958, 320, 48000, 60, 'PER_TON', now() + interval '3 days', now() + interval '6 days', 'CARGA_GRANEL', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 3, 'LOW'),

-- Produtor 2: Anthony Both Produtor
('5968c470-b7a8-4c53-90cd-68a2b726f5bb', 'Algodão', 18000, 'Fazenda Boa Vista, Nova Mutum - MT', -13.8361, -56.0831, 'Beneficiadora Textil, Jaciara - MT', -15.97, -54.97, 280, 50400, 2800, 'PER_TON', now() + interval '1 day', now() + interval '3 days', 'CARGA_AGRICOLA', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 'Jaciara', 'MT', '031753de-c91e-4495-8ebf-e106598378b1', 2, 'HIGH'),
('5968c470-b7a8-4c53-90cd-68a2b726f5bb', 'Gado Nelore', 8000, 'Fazenda Pecuária MT, Nova Mutum - MT', -13.8361, -56.0831, 'Frigorífico Norte, Nova Ubiratã - MT', -13.0128, -55.2594, 110, 12100, 110, 'PER_KM', now() + interval '1 day', now() + interval '2 days', 'TRANSPORTE_ANIMAIS', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 'Nova Ubiratã', 'MT', 'a1dfde3b-811b-4d4d-bea7-f60ec4e1f597', 1, 'HIGH'),

-- Produtor 3: Teste Produtor
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'Fertilizantes', 20000, 'Depósito Rural, Primavera do Leste - MT', -15.5561, -54.2958, 'Fazenda União, Lucas do Rio Verde - MT', -13.0587, -55.9087, 310, 27900, 90, 'PER_KM', now() + interval '4 days', now() + interval '7 days', 'CARGA', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 3, 'LOW'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'Trator John Deere', 5500, 'Fazenda Modelo, Primavera do Leste - MT', -15.5561, -54.2958, 'Oficina Mecânica Agrícola, Jaciara - MT', -15.97, -54.97, 65, 4550, 70, 'PER_KM', now() + interval '2 days', now() + interval '3 days', 'TRANSPORTE_MAQUINARIO', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 'Jaciara', 'MT', '031753de-c91e-4495-8ebf-e106598378b1', 1, 'MEDIUM'),

-- Produtor 4: Teste Produtor Rural
('4d62bceb-4c6e-47b5-bb62-7effd9b1ecf1', 'Arroz', 15000, 'Arrozeira Mato-grossense, Jaciara - MT', -15.97, -54.97, 'Cooperativa Agrícola, Nova Mutum - MT', -13.8361, -56.0831, 250, 37500, 2500, 'PER_TON', now() + interval '3 days', now() + interval '5 days', 'CARGA_GRANEL', 'Jaciara', 'MT', '031753de-c91e-4495-8ebf-e106598378b1', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 2, 'MEDIUM'),
('4d62bceb-4c6e-47b5-bb62-7effd9b1ecf1', 'Sorgo', 22000, 'Fazenda Cerrado, Jaciara - MT', -15.97, -54.97, 'Silo Regional, Primavera do Leste - MT', -15.5561, -54.2958, 75, 6750, 90, 'PER_KM', now() + interval '5 days', now() + interval '7 days', 'CARGA_AGRICOLA', 'Jaciara', 'MT', '031753de-c91e-4495-8ebf-e106598378b1', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 2, 'LOW'),

-- Produtor 5: Teste Outro
('5aa7455f-2d24-4ab0-ba50-2d9bf50a95a5', 'Madeira Serrada', 12000, 'Serraria Progresso, Pontes e Lacerda - MT', -15.2261, -59.3353, 'Depósito Central, Jaciara - MT', -15.97, -54.97, 480, 57600, 4800, 'PER_TON', now() + interval '2 days', now() + interval '5 days', 'CARGA_GERAL', 'Pontes e Lacerda', 'MT', '2a41e810-0752-4566-9adb-e2b34aa92f08', 'Jaciara', 'MT', '031753de-c91e-4495-8ebf-e106598378b1', 2, 'MEDIUM'),

-- Transportadora 1: fretes rurais e urbanos
('06812bbb-212e-4b4c-b4f2-2fc16f9094c5', 'Container', 8000, 'Terminal Rodoviário, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Zona Industrial, Nova Mutum - MT', -13.8361, -56.0831, 95, 8550, 90, 'PER_KM', now() + interval '1 day', now() + interval '2 days', 'CARGA_GERAL', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 1, 'HIGH'),
('06812bbb-212e-4b4c-b4f2-2fc16f9094c5', 'Carga Geral', 5000, 'Galpão Logístico, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Centro, Primavera do Leste - MT', -15.5561, -54.2958, 320, 28800, 90, 'PER_KM', now() + interval '3 days', now() + interval '5 days', 'CARGA', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 1, 'LOW'),

-- Transportadora 2: fretes urbanos
('8ddbadf3-4187-48fc-b890-59797ef74056', 'Móveis', 2000, 'Rua das Flores 123, Nova Mutum - MT', -13.8361, -56.0831, 'Av Brasil 456, Nova Mutum - MT', -13.84, -56.08, 8, 800, 100, 'PER_KM', now() + interval '1 day', now() + interval '1 day', 'MUDANCA', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 1, 'MEDIUM'),
('8ddbadf3-4187-48fc-b890-59797ef74056', 'Veículo Quebrado', 1500, 'Rodovia BR-163 km 450, Nova Mutum - MT', -13.8361, -56.0831, 'Oficina Central, Lucas do Rio Verde - MT', -13.0587, -55.9087, 95, 950, 10, 'PER_KM', now() + interval '0 days', now() + interval '1 day', 'GUINCHO', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 1, 'HIGH'),

-- Motorista 1: frete moto
('60f2073c-e7e3-483c-a6e4-2d76fbe6380e', 'Documentos', 500, 'Centro Comercial, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Fórum Municipal, Nova Mutum - MT', -13.8361, -56.0831, 95, 380, 4, 'PER_KM', now() + interval '0 days', now() + interval '1 day', 'FRETE_MOTO', 'Lucas do Rio Verde', 'MT', '41adf657-6155-4e82-ad5e-65860e3fb7a8', 'Nova Mutum', 'MT', '551cc512-9eab-462e-99c3-a0593e314207', 1, 'HIGH'),

-- Motorista 2: carga geral
('0d2ea0c3-db0f-491e-993a-8cd27e2f35ed', 'Peças Automotivas', 3000, 'Auto Peças MT, Primavera do Leste - MT', -15.5561, -54.2958, 'Concessionária Central, Jaciara - MT', -15.97, -54.97, 65, 5850, 90, 'PER_KM', now() + interval '2 days', now() + interval '3 days', 'CARGA_GERAL', 'Primavera do Leste', 'MT', '72e2661e-0ffc-4d4f-a032-004edd82a0d8', 'Jaciara', 'MT', '031753de-c91e-4495-8ebf-e106598378b1', 1, 'MEDIUM');

-- =============================================
-- DADOS DE TESTE: SERVICE REQUESTS
-- =============================================

INSERT INTO service_requests (client_id, service_type, location_address, location_lat, location_lng, problem_description, urgency, contact_phone, contact_name, status, location_city, location_state, city_name, state, city_lat, city_lng, city_id) VALUES
-- Produtores solicitando serviços técnicos
('04924959-d415-4c25-9ef3-209dc29ed30a', 'MECANICO', 'Fazenda Santa Helena, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Trator New Holland com problema na bomba injetora. Necessário mecânico especializado em diesel.', 'HIGH', '(66) 99999-1001', 'Alex Alcides', 'PENDING', 'Lucas do Rio Verde', 'MT', 'Lucas do Rio Verde', 'MT', -13.0587, -55.9087, '41adf657-6155-4e82-ad5e-65860e3fb7a8'),
('04924959-d415-4c25-9ef3-209dc29ed30a', 'ANALISE_SOLO', 'Talhão 15, Fazenda Santa Helena, Lucas do Rio Verde - MT', -13.06, -55.91, 'Análise de solo completa para planejamento de safra 2026/2027. Área de 500 hectares.', 'LOW', '(66) 99999-1001', 'Alex Alcides', 'PENDING', 'Lucas do Rio Verde', 'MT', 'Lucas do Rio Verde', 'MT', -13.0587, -55.9087, '41adf657-6155-4e82-ad5e-65860e3fb7a8'),

('5968c470-b7a8-4c53-90cd-68a2b726f5bb', 'PIVO_IRRIGACAO', 'Fazenda Boa Vista, Nova Mutum - MT', -13.8361, -56.0831, 'Pivô central com vazamento na junta rotativa. Necessário técnico urgente.', 'HIGH', '(66) 99999-1002', 'Anthony Produtor', 'PENDING', 'Nova Mutum', 'MT', 'Nova Mutum', 'MT', -13.8361, -56.0831, '551cc512-9eab-462e-99c3-a0593e314207'),
('5968c470-b7a8-4c53-90cd-68a2b726f5bb', 'TECNICO_AGRICOLA', 'Fazenda Boa Vista, Nova Mutum - MT', -13.8361, -56.0831, 'Consultoria técnica para manejo de pragas na lavoura de soja. Área com 200ha afetada.', 'MEDIUM', '(66) 99999-1002', 'Anthony Produtor', 'PENDING', 'Nova Mutum', 'MT', 'Nova Mutum', 'MT', -13.8361, -56.0831, '551cc512-9eab-462e-99c3-a0593e314207'),

('a885f432-99a5-41e9-8b07-f0794ba55af4', 'BORRACHARIA', 'Estrada Vicinal km 12, Primavera do Leste - MT', -15.56, -54.30, 'Pneu de caminhão furado na estrada rural. Necessário borracheiro móvel com urgência.', 'HIGH', '(66) 99999-1003', 'Teste Produtor', 'PENDING', 'Primavera do Leste', 'MT', 'Primavera do Leste', 'MT', -15.5561, -54.2958, '72e2661e-0ffc-4d4f-a032-004edd82a0d8'),
('a885f432-99a5-41e9-8b07-f0794ba55af4', 'SECADOR_SECAGEM', 'Fazenda Modelo, Primavera do Leste - MT', -15.5561, -54.2958, 'Secador de grãos com problema na fornalha. Necessário manutenção preventiva antes da colheita.', 'MEDIUM', '(66) 99999-1003', 'Teste Produtor', 'PENDING', 'Primavera do Leste', 'MT', 'Primavera do Leste', 'MT', -15.5561, -54.2958, '72e2661e-0ffc-4d4f-a032-004edd82a0d8'),

('4d62bceb-4c6e-47b5-bb62-7effd9b1ecf1', 'TOPOGRAFIA', 'Fazenda Cerrado, Jaciara - MT', -15.97, -54.97, 'Levantamento topográfico para abertura de nova área de 150 hectares. Necessário equipamento RTK.', 'LOW', '(66) 99999-1004', 'Teste Rural', 'PENDING', 'Jaciara', 'MT', 'Jaciara', 'MT', -15.97, -54.97, '031753de-c91e-4495-8ebf-e106598378b1'),
('4d62bceb-4c6e-47b5-bb62-7effd9b1ecf1', 'TORNEARIA_SOLDA', 'Oficina Fazenda Cerrado, Jaciara - MT', -15.97, -54.97, 'Solda em grade aradora quebrada. Peça de aço carbono 2 polegadas.', 'MEDIUM', '(66) 99999-1004', 'Teste Rural', 'PENDING', 'Jaciara', 'MT', 'Jaciara', 'MT', -15.97, -54.97, '031753de-c91e-4495-8ebf-e106598378b1'),

-- Motoristas solicitando serviços
('60f2073c-e7e3-483c-a6e4-2d76fbe6380e', 'GUINCHO', 'BR-163 km 500, Lucas do Rio Verde - MT', -13.05, -55.91, 'Caminhão truck com problema na embreagem. Necessário guincho para oficina mais próxima.', 'HIGH', '(66) 99999-2001', 'Anthony Motorista', 'PENDING', 'Lucas do Rio Verde', 'MT', 'Lucas do Rio Verde', 'MT', -13.0587, -55.9087, '41adf657-6155-4e82-ad5e-65860e3fb7a8'),
('60f2073c-e7e3-483c-a6e4-2d76fbe6380e', 'AUTO_ELETRICA', 'Posto Ipiranga, Lucas do Rio Verde - MT', -13.06, -55.91, 'Alternador queimado. Caminhão não liga. Necessário auto elétrica móvel.', 'HIGH', '(66) 99999-2001', 'Anthony Motorista', 'PENDING', 'Lucas do Rio Verde', 'MT', 'Lucas do Rio Verde', 'MT', -13.0587, -55.9087, '41adf657-6155-4e82-ad5e-65860e3fb7a8'),

('0d2ea0c3-db0f-491e-993a-8cd27e2f35ed', 'BORRACHARIA', 'MT-130 km 80, Primavera do Leste - MT', -15.55, -54.30, 'Pneu dianteiro direito estourou na rodovia. Preciso de borracheiro urgente.', 'HIGH', '(66) 99999-2002', 'Teste Centoeum', 'PENDING', 'Primavera do Leste', 'MT', 'Primavera do Leste', 'MT', -15.5561, -54.2958, '72e2661e-0ffc-4d4f-a032-004edd82a0d8'),
('0d2ea0c3-db0f-491e-993a-8cd27e2f35ed', 'MECANICO', 'Pátio de caminhões, Primavera do Leste - MT', -15.5561, -54.2958, 'Freio de ar com vazamento. Necessário mecânico de freio pneumático.', 'MEDIUM', '(66) 99999-2002', 'Teste Centoeum', 'PENDING', 'Primavera do Leste', 'MT', 'Primavera do Leste', 'MT', -15.5561, -54.2958, '72e2661e-0ffc-4d4f-a032-004edd82a0d8'),

-- Prestadores solicitando serviços urbanos (mudança, frete urbano)
('51514314-a378-41a8-b5ba-5f2c7c29dac1', 'MUDANCA_RESIDENCIAL', 'Rua Mato Grosso 500, Lucas do Rio Verde - MT', -13.0587, -55.9087, 'Mudança residencial de apartamento 2 quartos. Geladeira, sofá, 2 camas, mesa.', 'MEDIUM', '(66) 99999-3001', 'Anthony Both', 'PENDING', 'Lucas do Rio Verde', 'MT', 'Lucas do Rio Verde', 'MT', -13.0587, -55.9087, '41adf657-6155-4e82-ad5e-65860e3fb7a8'),

('62726b56-b7e1-4724-a618-0991a5e1cb24', 'FRETE_URBANO', 'Loja Material Construção, Nova Mutum - MT', -13.8361, -56.0831, 'Entrega de 50 sacos de cimento e 20m² de piso cerâmico para obra residencial.', 'MEDIUM', '(66) 99999-3002', 'Anthony Prestador', 'PENDING', 'Nova Mutum', 'MT', 'Nova Mutum', 'MT', -13.8361, -56.0831, '551cc512-9eab-462e-99c3-a0593e314207'),

('2d91d20a-1e52-4f50-ad4e-e912a8fb4609', 'CFTV_SEGURANCA', 'Fazenda São José, Jaciara - MT', -15.97, -54.97, 'Instalação de 8 câmeras de segurança com DVR e acesso remoto. Fazenda de 500ha.', 'LOW', '(66) 99999-3003', 'Anthony Presta', 'PENDING', 'Jaciara', 'MT', 'Jaciara', 'MT', -15.97, -54.97, '031753de-c91e-4495-8ebf-e106598378b1'),

('5273fa36-6729-4c66-b2d4-62eebd313afe', 'MECANICO_INDUSTRIAL', 'Parque Industrial, Primavera do Leste - MT', -15.5561, -54.2958, 'Manutenção preventiva em esteira transportadora de grãos. Troca de rolamentos e correia.', 'MEDIUM', '(66) 99999-3004', 'Teste Quatro', 'PENDING', 'Primavera do Leste', 'MT', 'Primavera do Leste', 'MT', -15.5561, -54.2958, '72e2661e-0ffc-4d4f-a032-004edd82a0d8'),

('aa78b14e-cb69-4982-8c1f-ed217c498f88', 'SERVICO_AGRICOLA', 'Fazenda Esperança, Nova Ubiratã - MT', -13.0128, -55.2594, 'Pulverização aérea em 300 hectares de soja. Aplicação de fungicida.', 'HIGH', '(66) 99999-3005', 'Vilmar Pedro', 'PENDING', 'Nova Ubiratã', 'MT', 'Nova Ubiratã', 'MT', -13.0128, -55.2594, 'a1dfde3b-811b-4d4d-bea7-f60ec4e1f597');
