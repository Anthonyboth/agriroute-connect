-- Verificar e criar registro na service_providers se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.service_providers 
    WHERE profile_id = '950a8ca0-db8c-4f8c-9a21-80917dedf690'
  ) THEN
    INSERT INTO public.service_providers (
      profile_id,
      service_type,
      service_radius_km,
      service_area_cities,
      emergency_service,
      works_weekends,
      works_holidays
    )
    VALUES (
      '950a8ca0-db8c-4f8c-9a21-80917dedf690',
      'CHAVEIRO',
      50,
      ARRAY['Primavera do Leste, MT'],
      true,
      true,  
      true
    );
  END IF;
END $$;