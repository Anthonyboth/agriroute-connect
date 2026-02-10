
-- Limpar fretes antigos de teste (todos do MT/MS/PE)
DELETE FROM match_exposures WHERE item_id IN (
  'b410e402-47a1-46ac-8d7f-35bf908ae74e','9709664d-6429-4e35-a825-2022634249c3',
  '01ad845b-72c2-43c3-a459-294f2fdb7c39','1cf5a20e-1522-46fa-9ea7-1eaff418dd7b',
  '7ceba99b-ac65-46fe-a4ed-f828cb789170','f8a38fda-e456-4277-b197-3d9b6d28ab13',
  '05e8e90a-ec1d-41f9-b450-87bed7212675','988b93c5-7d79-4c43-a634-aeb78d7865ee',
  '9b7ece41-dea1-40bb-8b8d-48e841d31f05','0b2dbbc0-6ede-415b-ac4f-bff06e8c994d',
  '6c2cbc04-345c-4dc5-864f-b52a7dd12c31'
);
DELETE FROM freight_assignments WHERE freight_id IN (
  'b410e402-47a1-46ac-8d7f-35bf908ae74e','9709664d-6429-4e35-a825-2022634249c3',
  '01ad845b-72c2-43c3-a459-294f2fdb7c39','1cf5a20e-1522-46fa-9ea7-1eaff418dd7b',
  '7ceba99b-ac65-46fe-a4ed-f828cb789170','f8a38fda-e456-4277-b197-3d9b6d28ab13',
  '05e8e90a-ec1d-41f9-b450-87bed7212675','988b93c5-7d79-4c43-a634-aeb78d7865ee',
  '9b7ece41-dea1-40bb-8b8d-48e841d31f05','0b2dbbc0-6ede-415b-ac4f-bff06e8c994d',
  '6c2cbc04-345c-4dc5-864f-b52a7dd12c31'
);
DELETE FROM freights WHERE id IN (
  'b410e402-47a1-46ac-8d7f-35bf908ae74e','9709664d-6429-4e35-a825-2022634249c3',
  '01ad845b-72c2-43c3-a459-294f2fdb7c39','1cf5a20e-1522-46fa-9ea7-1eaff418dd7b',
  '7ceba99b-ac65-46fe-a4ed-f828cb789170','f8a38fda-e456-4277-b197-3d9b6d28ab13',
  '05e8e90a-ec1d-41f9-b450-87bed7212675','988b93c5-7d79-4c43-a634-aeb78d7865ee',
  '9b7ece41-dea1-40bb-8b8d-48e841d31f05','0b2dbbc0-6ede-415b-ac4f-bff06e8c994d',
  '6c2cbc04-345c-4dc5-864f-b52a7dd12c31'
);

-- Inserir 14 fretes novos por todas as regiões do Brasil
DO $$
DECLARE
  v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM profiles LIMIT 1;

  INSERT INTO freights (id, producer_id, origin_city, origin_state, destination_city, destination_state,
    origin_city_id, destination_city_id, origin_lat, origin_lng, destination_lat, destination_lng,
    origin_address, destination_address, service_type, status, cargo_type, weight, price, pickup_date, delivery_date) VALUES
  ('f0000001-0001-0001-0001-000000000001',v_uid,'Manaus','AM','Belém','PA',
   'be80de4b-f674-451f-a803-280b6ba69835','42b8e269-8c2c-4582-82d8-ab2a8d5dcd2b',
   -3.1190,-60.0217,-1.4558,-48.5024,'Distrito Industrial, Manaus','Porto de Belém',
   'CARGA','OPEN','Grãos',25000,8500,NOW()+interval '3 days',NOW()+interval '6 days'),
  ('f0000001-0001-0001-0001-000000000002',v_uid,'Salvador','BA','Fortaleza','CE',
   'a2766804-264c-4507-84cd-cb55071dc609','5b8d66f0-6b1e-4c47-92a3-83de50697f8e',
   -12.9714,-38.5124,-3.7172,-38.5433,'Porto de Salvador','Porto Mucuripe, Fortaleza',
   'CARGA','OPEN','Algodão',18000,6200,NOW()+interval '2 days',NOW()+interval '5 days'),
  ('f0000001-0001-0001-0001-000000000003',v_uid,'São Paulo','SP','Porto Alegre','RS',
   '8524100f-86e6-4d1d-b082-0dd6bdab72a5','42d78901-b2f3-4073-a79e-762b4c4834f1',
   -23.5505,-46.6333,-30.0346,-51.2177,'Marginal Tietê, SP','BR-290, Porto Alegre',
   'MUDANCA','OPEN','Mudança',5000,4500,NOW()+interval '5 days',NOW()+interval '7 days'),
  ('f0000001-0001-0001-0001-000000000004',v_uid,'Cuiabá','MT','Goiânia','GO',
   'b5a91d94-7472-420b-97df-11d39672eca0','6079766a-e950-4c96-8bbe-2cf74a04e0e8',
   -15.6014,-56.0979,-16.6869,-49.2648,'BR-163, Cuiabá','BR-060, Goiânia',
   'CARGA','OPEN','Soja',30000,7800,NOW()+interval '1 day',NOW()+interval '3 days'),
  ('f0000001-0001-0001-0001-000000000005',v_uid,'Recife','PE','São Luís','MA',
   '5e178dfd-934d-4ec1-91db-843dbc3503c9','71cc1141-d876-45d4-8011-283020452125',
   -8.0476,-34.8770,-2.5297,-44.2825,'BR-101, Recife','Av. Holandeses, São Luís',
   'GUINCHO','OPEN','Veículo',2000,3200,NOW()+interval '1 day',NOW()+interval '3 days'),
  ('f0000001-0001-0001-0001-000000000006',v_uid,'Porto Velho','RO','Manaus','AM',
   '79a6f101-2524-4fc4-9a00-1d1b6024674c','be80de4b-f674-451f-a803-280b6ba69835',
   -8.7612,-63.9004,-3.1190,-60.0217,'BR-364, Porto Velho','Distrito Industrial, Manaus',
   'CARGA','OPEN','Madeira',20000,6900,NOW()+interval '4 days',NOW()+interval '7 days'),
  ('f0000001-0001-0001-0001-000000000007',v_uid,'Rio de Janeiro','RJ','Belo Horizonte','MG',
   'c2c92305-0f3a-477d-bcf9-9d98438128e4','e73a7a44-ffff-4d8c-b003-8acc9580ae8d',
   -22.9068,-43.1729,-19.9167,-43.9345,'Rodovia Dutra, RJ','Anel Rodoviário, BH',
   'CARGA','OPEN','Cimento',15000,3500,NOW()+interval '2 days',NOW()+interval '4 days'),
  ('f0000001-0001-0001-0001-000000000008',v_uid,'Curitiba','PR','São Paulo','SP',
   '999a68c8-25b8-4655-b965-89337987981a','8524100f-86e6-4d1d-b082-0dd6bdab72a5',
   -25.4284,-49.2733,-23.5505,-46.6333,'BR-116, Curitiba','Rodoanel, SP',
   'MUDANCA','OPEN','Mudança Comercial',8000,3800,NOW()+interval '7 days',NOW()+interval '9 days'),
  ('f0000001-0001-0001-0001-000000000009',v_uid,'Brasília','DF','Salvador','BA',
   'ea521563-749e-49bf-b624-eda08f210e3a','a2766804-264c-4507-84cd-cb55071dc609',
   -15.7975,-47.8919,-12.9714,-38.5124,'CEASA, Brasília','Porto de Salvador',
   'CARGA','OPEN','Fertilizantes',22000,7200,NOW()+interval '3 days',NOW()+interval '6 days'),
  ('f0000001-0001-0001-0001-000000000010',v_uid,'Goiânia','GO','Rondonópolis','MT',
   '6079766a-e950-4c96-8bbe-2cf74a04e0e8','a88c3b82-3a3d-4fde-bb08-fd1c7c90757d',
   -16.6869,-49.2648,-16.4673,-54.6372,'BR-060, Goiânia','BR-364, Rondonópolis',
   'CARGA','OPEN','Milho',28000,5100,NOW()+interval '2 days',NOW()+interval '4 days'),
  ('f0000001-0001-0001-0001-000000000011',v_uid,'Fortaleza','CE','Manaus','AM',
   '5b8d66f0-6b1e-4c47-92a3-83de50697f8e','be80de4b-f674-451f-a803-280b6ba69835',
   -3.7172,-38.5433,-3.1190,-60.0217,'Porto Pecém, Fortaleza','Distrito Industrial, Manaus',
   'CARGA','CANCELLED','Peças',10000,9500,NOW()+interval '5 days',NOW()+interval '10 days'),
  ('f0000001-0001-0001-0001-000000000012',v_uid,'Porto Alegre','RS','Recife','PE',
   '42d78901-b2f3-4073-a79e-762b4c4834f1','5e178dfd-934d-4ec1-91db-843dbc3503c9',
   -30.0346,-51.2177,-8.0476,-34.8770,'BR-290, Porto Alegre','BR-101, Recife',
   'CARGA','OPEN','Eletrônicos',12000,11000,NOW()+interval '6 days',NOW()+interval '10 days'),
  ('f0000001-0001-0001-0001-000000000013',v_uid,'São Luís','MA','Belém','PA',
   '71cc1141-d876-45d4-8011-283020452125','42b8e269-8c2c-4582-82d8-ab2a8d5dcd2b',
   -2.5297,-44.2825,-1.4558,-48.5024,'BR-135, São Luís','Porto de Belém',
   'GUINCHO','OPEN','Maquinário',3000,2800,NOW()+interval '1 day',NOW()+interval '3 days'),
  ('f0000001-0001-0001-0001-000000000014',v_uid,'Belo Horizonte','MG','Brasília','DF',
   'e73a7a44-ffff-4d8c-b003-8acc9580ae8d','ea521563-749e-49bf-b624-eda08f210e3a',
   -19.9167,-43.9345,-15.7975,-47.8919,'Anel Rodoviário, BH','CEASA, Brasília',
   'CARGA','OPEN','Café',16000,4200,NOW()+interval '4 days',NOW()+interval '6 days');
END $$;
