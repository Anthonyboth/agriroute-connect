
DO $$
DECLARE
  v_producer_id uuid := 'a885f432-99a5-41e9-8b07-f0794ba55af4';
  v_pickup timestamptz := now() + interval '2 days';
  v_delivery timestamptz := now() + interval '5 days';
  
  v_city_ids uuid[] := ARRAY[
    '72e2661e-0ffc-4d4f-a032-004edd82a0d8','a88c3b82-3a3d-4fde-bb08-fd1c7c90757d',
    'b5a91d94-7472-420b-97df-11d39672eca0','0a3e0bf1-9562-41c2-bbf3-1ffd80f47869',
    '34cc76dd-0659-46ac-aa2e-33a846c9b1d7','41adf657-6155-4e82-ad5e-65860e3fb7a8',
    '551cc512-9eab-462e-99c3-a0593e314207','3603c0c1-a608-4086-ab51-f25dd13f775e',
    '978ad67f-2e3e-4987-8b15-ca126f0e3644','22f489fa-2fe0-4044-81c2-7c8b6c2db3eb'
  ];
  v_city_names text[] := ARRAY[
    'Primavera do Leste','Rondonópolis','Cuiabá','Sorriso','Sinop',
    'Lucas do Rio Verde','Nova Mutum','Tangará da Serra','Campo Novo do Parecis','Sapezal'
  ];
  v_dest_city_ids uuid[] := ARRAY[
    '51786b98-c7e0-42a6-b3c5-8f77712e0a3a','cfb9b0ab-bc96-4de3-99c8-983780609a96',
    'bca7b98f-552a-4340-8afa-47ea869bca8b','d23f4c9e-82ac-4059-aa6a-b67cb7785d7f',
    'bc59b822-d248-48da-8cc7-8a60c36dc7c7','397440ce-8de7-44cf-8e91-f6d7149f9410',
    '3764c0d8-1471-4790-ad6d-9d556cf577b5','799e3254-04f9-45c2-8428-c0754863268c',
    '6079766a-e950-4c96-8bbe-2cf74a04e0e8','237f89ea-0199-4d77-a013-c10312259f0d'
  ];
  v_dest_city_names text[] := ARRAY[
    'Diamantino','Poxoréu','Água Boa','Canarana','Barra do Garças',
    'Alta Floresta','Juara','Querência','Goiânia','Campo Grande'
  ];
  
  v_cargo_types text[] := ARRAY['Soja','Milho','Algodão','Arroz','Sorgo','Café','Trigo','Feijão','Açúcar','Gado Vivo'];
  v_vehicle_types vehicle_type[] := ARRAY['CARRETA','BITREM','RODOTREM','TRUCK','CARRETA_GRANELEIRA'];
  v_urgencies urgency_level[] := ARRAY['LOW','MEDIUM','HIGH'];
  v_trucks int[] := ARRAY[1,1,1,2,3,1,6,1,2,1];
  v_svc_types text[] := ARRAY['GUINCHO','MUDANCA','FRETE_MOTO','TRANSPORTE_PET','ENTREGA_PACOTES'];
  v_svc_urgencies text[] := ARRAY['LOW','MEDIUM','HIGH','CRITICAL'];
  
  i int; oi int; di int;
BEGIN
  -- 50 FRETES RURAIS OPEN (peso >= 100 toneladas para respeitar trigger)
  FOR i IN 1..50 LOOP
    oi := ((i-1) % 10) + 1;
    di := ((i + 4) % 10) + 1;
    INSERT INTO public.freights (
      producer_id, cargo_type, weight,
      origin_address, origin_city_id, origin_lat, origin_lng,
      destination_address, destination_city_id, destination_lat, destination_lng,
      distance_km, price, pickup_date, delivery_date,
      status, urgency, service_type, vehicle_type_required,
      required_trucks, accepted_trucks, payment_method, description
    ) VALUES (
      v_producer_id,
      v_cargo_types[((i-1) % 10) + 1],
      (100 + i * 5)::numeric,  -- peso em toneladas, mínimo 100
      v_city_names[oi] || '/MT - Fazenda Seed ' || i,
      v_city_ids[oi],
      -15.0 + (i * 0.05), -54.0 + (i * 0.03),
      v_dest_city_names[di] || ' - Destino Seed ' || i,
      v_dest_city_ids[di],
      -15.5 + (i * 0.04), -55.0 + (i * 0.02),
      (150 + i * 20)::numeric,
      (2500 + i * 100)::numeric,
      v_pickup + (i || ' hours')::interval,
      v_delivery + (i || ' hours')::interval,
      'OPEN'::freight_status,
      v_urgencies[((i-1) % 3) + 1],
      'CARGA',
      v_vehicle_types[((i-1) % 5) + 1],
      v_trucks[((i-1) % 10) + 1],
      0,
      'PIX'::payment_method,
      'Frete seed #' || i || ' - ' || v_cargo_types[((i-1) % 10) + 1] || ' de ' || v_city_names[oi] || ' para ' || v_dest_city_names[di]
    );
  END LOOP;

  -- 50 SERVIÇOS URBANOS OPEN
  FOR i IN 1..50 LOOP
    oi := ((i-1) % 10) + 1;
    INSERT INTO public.service_requests (
      client_id, service_type,
      location_address, location_lat, location_lng,
      problem_description, urgency, contact_phone, contact_name,
      status, city_name, state, city_id,
      estimated_price, is_emergency, preferred_datetime
    ) VALUES (
      v_producer_id,
      v_svc_types[((i-1) % 5) + 1],
      v_city_names[oi] || ' - Local Seed ' || i,
      -15.0 + (i * 0.04), -54.0 + (i * 0.02),
      'Serviço seed #' || i || ' - ' || v_svc_types[((i-1) % 5) + 1] || ' em ' || v_city_names[oi],
      v_svc_urgencies[((i-1) % 4) + 1],
      '66999' || lpad(i::text, 5, '0'),
      'Cliente Seed ' || i,
      'OPEN',
      v_city_names[oi],
      'MT',
      v_city_ids[oi],
      (150 + i * 30)::numeric,
      (i % 5 = 0),
      v_pickup + (i || ' hours')::interval
    );
  END LOOP;
END $$;
