
-- Coordenadas das cidades já foram atualizadas nas migrações anteriores.
-- Fretes também já foram inseridos com sucesso. Agora só faltam os service_requests.

DO $$
DECLARE
  v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM profiles LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No user'; END IF;

  INSERT INTO service_requests (id, client_id, service_type, city_name, state, city_id,
    city_lat, city_lng, location_lat, location_lng, location_address,
    problem_description, contact_phone, contact_name, status, urgency) VALUES
  ('a0000001-0001-0001-0001-000000000001',v_uid,'AGRONOMO','Manaus','AM','be80de4b-f674-451f-a803-280b6ba69835',
   -3.1190,-60.0217,-3.1190,-60.0217,'Zona Franca, Manaus','Análise solo','92999001001','Teste Norte','OPEN','MEDIUM'),
  ('a0000001-0001-0001-0001-000000000002',v_uid,'MECANICO','Salvador','BA','a2766804-264c-4507-84cd-cb55071dc609',
   -12.9714,-38.5124,-12.9714,-38.5124,'Av. Paralela, Salvador','Reparo motor','71999002002','Teste NE','OPEN','HIGH'),
  ('a0000001-0001-0001-0001-000000000003',v_uid,'BORRACHEIRO','São Paulo','SP','8524100f-86e6-4d1d-b082-0dd6bdab72a5',
   -23.5505,-46.6333,-23.5505,-46.6333,'Marginal Tietê, SP','Pneu furado','11999003003','Teste SE','OPEN','HIGH'),
  ('a0000001-0001-0001-0001-000000000004',v_uid,'AGRONOMO','Porto Alegre','RS','42d78901-b2f3-4073-a79e-762b4c4834f1',
   -30.0346,-51.2177,-30.0346,-51.2177,'BR-290, Porto Alegre','Arroz irrigado','51999004004','Teste Sul','OPEN','LOW'),
  ('a0000001-0001-0001-0001-000000000005',v_uid,'MECANICO','Goiânia','GO','6079766a-e950-4c96-8bbe-2cf74a04e0e8',
   -16.6869,-49.2648,-16.6869,-49.2648,'Anel Viário, Goiânia','Embreagem','62999005005','Teste CO','OPEN','MEDIUM'),
  ('a0000001-0001-0001-0001-000000000006',v_uid,'ARMAZENAGEM','Brasília','DF','ea521563-749e-49bf-b624-eda08f210e3a',
   -15.7975,-47.8919,-15.7975,-47.8919,'CEASA Brasília','Grãos','61999006006','Teste DF','OPEN','LOW'),
  ('a0000001-0001-0001-0001-000000000007',v_uid,'AGRONOMO','Cuiabá','MT','b5a91d94-7472-420b-97df-11d39672eca0',
   -15.6014,-56.0979,-15.6014,-56.0979,'BR-163, Cuiabá','Pragas soja','65999007007','Teste MT','OPEN','HIGH'),
  ('a0000001-0001-0001-0001-000000000008',v_uid,'BORRACHEIRO','Recife','PE','5e178dfd-934d-4ec1-91db-843dbc3503c9',
   -8.0476,-34.8770,-8.0476,-34.8770,'BR-101, Recife','Troca pneus','81999008008','Teste PE','OPEN','MEDIUM'),
  ('a0000001-0001-0001-0001-000000000009',v_uid,'MECANICO','Rio de Janeiro','RJ','c2c92305-0f3a-477d-bcf9-9d98438128e4',
   -22.9068,-43.1729,-22.9068,-43.1729,'Dutra, RJ','Motor','21999009009','Teste RJ','COMPLETED','LOW'),
  ('a0000001-0001-0001-0001-000000000010',v_uid,'CARGA','Fortaleza','CE','5b8d66f0-6b1e-4c47-92a3-83de50697f8e',
   -3.7172,-38.5433,-3.7172,-38.5433,'Porto Pecém, CE','Container','85999010010','Teste CE','OPEN','HIGH');
END $$;
