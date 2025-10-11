-- =====================================================
-- MIGRATION: Corrigir Match Inteligente Definitivamente
-- =====================================================

-- 1. QUALIFICAR POSTGIS COM extensions. EM TODAS AS FUNÇÕES
-- =====================================================

-- 1.1 Função: get_compatible_freights_for_driver
CREATE OR REPLACE FUNCTION public.get_compatible_freights_for_driver(p_driver_id uuid)
RETURNS TABLE(freight_id uuid, cargo_type text, weight numeric, origin_address text, destination_address text, pickup_date date, delivery_date date, price numeric, urgency text, status text, service_type text, distance_km numeric, minimum_antt_price numeric, required_trucks integer, accepted_trucks integer, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  driver_services text[];
BEGIN
  SELECT service_types INTO driver_services
  FROM public.profiles 
  WHERE id = p_driver_id AND role = 'MOTORISTA';
  
  IF driver_services IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    f.id,
    f.cargo_type,
    f.weight,
    f.origin_address,
    f.destination_address,
    f.pickup_date,
    f.delivery_date,
    f.price,
    f.urgency::text,
    f.status::text,
    f.service_type,
    f.distance_km,
    f.minimum_antt_price,
    f.required_trucks,
    f.accepted_trucks,
    f.created_at
  FROM public.freights f
  WHERE 
    f.status = 'OPEN'
    AND f.accepted_trucks < f.required_trucks
    AND public.is_service_compatible(driver_services, COALESCE(f.service_type, 'CARGA'))
    AND (
      EXISTS (
        SELECT 1 
        FROM public.driver_service_areas dsa
        WHERE dsa.driver_id = p_driver_id
          AND dsa.is_active = true
          AND (
            (
              f.origin_city IS NOT NULL 
              AND f.origin_state IS NOT NULL
              AND LOWER(TRIM(dsa.city_name)) = LOWER(TRIM(f.origin_city))
              AND LOWER(TRIM(dsa.state)) = LOWER(TRIM(f.origin_state))
            )
            OR
            (
              f.destination_city IS NOT NULL 
              AND f.destination_state IS NOT NULL
              AND LOWER(TRIM(dsa.city_name)) = LOWER(TRIM(f.destination_city))
              AND LOWER(TRIM(dsa.state)) = LOWER(TRIM(f.destination_state))
            )
            OR
            (
              f.origin_geog IS NOT NULL
              AND dsa.geom IS NOT NULL
              AND extensions.ST_DWithin(
                dsa.geom::extensions.geography, 
                f.origin_geog::extensions.geography, 
                COALESCE(dsa.radius_m, dsa.radius_km * 1000)::double precision
              )
            )
          )
      )
    )
  ORDER BY f.created_at DESC;
END;
$function$;

-- 1.2 Função: get_freights_in_radius
CREATE OR REPLACE FUNCTION public.get_freights_in_radius(p_driver_id uuid)
RETURNS TABLE(freight_id uuid, distance_m numeric, cargo_type text, origin_address text, destination_address text, price numeric, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    extensions.ST_Distance(dsa.geom::extensions.geography, f.origin_geog::extensions.geography)::numeric as distance_m,
    f.cargo_type,
    f.origin_address,
    f.destination_address,
    f.price,
    f.status::text
  FROM freights f
  CROSS JOIN driver_service_areas dsa
  WHERE dsa.driver_id = p_driver_id
    AND dsa.is_active = true
    AND f.status = 'OPEN'
    AND f.origin_geog IS NOT NULL
    AND extensions.ST_DWithin(
      f.origin_geog::extensions.geography, 
      dsa.geom::extensions.geography, 
      (dsa.radius_km * 1000)::double precision
    )
  ORDER BY distance_m;
END;
$function$;

-- 1.3 Função: get_service_requests_in_radius
CREATE OR REPLACE FUNCTION public.get_service_requests_in_radius(p_provider_id uuid)
RETURNS TABLE(request_id uuid, distance_m numeric, service_type text, origin_address text, destination_address text, price numeric, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id,
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(sr.origin_lng::double precision, sr.origin_lat::double precision), 4326)::extensions.geography,
      spa.geom::extensions.geography
    )::numeric as distance_m,
    sr.service_type,
    sr.origin_address,
    sr.destination_address,
    sr.price,
    sr.status
  FROM urban_service_requests sr
  CROSS JOIN service_provider_areas spa
  WHERE spa.provider_id = p_provider_id
    AND spa.is_active = true
    AND sr.status = 'PENDING'
    AND sr.origin_lat IS NOT NULL
    AND sr.origin_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(sr.origin_lng::double precision, sr.origin_lat::double precision), 4326)::extensions.geography,
      spa.geom::extensions.geography,
      (spa.radius_km * 1000)::double precision
    )
  ORDER BY distance_m;
END;
$function$;

-- 1.4 Função: find_drivers_by_origin
CREATE OR REPLACE FUNCTION public.find_drivers_by_origin(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, distance_m numeric, city_name text, radius_km numeric, match_method text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  freight_rec RECORD;
BEGIN
  SELECT origin_geog, origin_lat, origin_lng, origin_city, origin_state
  INTO freight_rec
  FROM freights WHERE id = freight_uuid;
  
  IF freight_rec.origin_lat IS NOT NULL AND freight_rec.origin_lng IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id, 
      dsa.id, 
      extensions.ST_Distance(dsa.geom::extensions.geography, freight_rec.origin_geog::extensions.geography)::numeric, 
      dsa.city_name, 
      dsa.radius_km, 
      'GEOGRAPHIC'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true 
      AND extensions.ST_DWithin(
        dsa.geom::extensions.geography, 
        freight_rec.origin_geog::extensions.geography, 
        COALESCE(dsa.radius_m, dsa.radius_km * 1000)::double precision
      )
    ORDER BY 3;
  ELSIF freight_rec.origin_city IS NOT NULL AND freight_rec.origin_state IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      dsa.driver_id, 
      dsa.id, 
      NULL::numeric, 
      dsa.city_name, 
      dsa.radius_km, 
      'CITY_STATE'::text
    FROM driver_service_areas dsa
    WHERE dsa.is_active = true 
      AND LOWER(dsa.city_name) = LOWER(freight_rec.origin_city) 
      AND LOWER(dsa.state) = LOWER(freight_rec.origin_state)
    ORDER BY dsa.city_name;
  END IF;
END;
$function$;

-- 1.5 Função: execute_freight_matching
CREATE OR REPLACE FUNCTION public.execute_freight_matching(freight_uuid uuid)
RETURNS TABLE(driver_id uuid, driver_area_id uuid, match_type text, distance_m numeric, match_score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  rec RECORD;
BEGIN
  DELETE FROM freight_matches WHERE freight_id = freight_uuid;
  
  FOR rec IN SELECT * FROM find_drivers_by_origin(freight_uuid) LOOP
    INSERT INTO freight_matches (
      freight_id, driver_id, driver_area_id, match_type, distance_m, match_score
    ) VALUES (
      freight_uuid, 
      rec.driver_id, 
      rec.driver_area_id, 
      CASE 
        WHEN rec.match_method = 'GEOGRAPHIC' THEN 'ORIGIN'
        WHEN rec.match_method = 'CITY_STATE' THEN 'CITY'
        ELSE 'ORIGIN'
      END,
      rec.distance_m,
      CASE 
        WHEN rec.match_method = 'GEOGRAPHIC' AND rec.distance_m IS NOT NULL 
          THEN GREATEST(0.1, 1.0 - (rec.distance_m / (rec.radius_km * 1000)))
        WHEN rec.match_method = 'CITY_STATE' THEN 0.9
        ELSE 0.5
      END
    ) ON CONFLICT (freight_id, driver_id, driver_area_id) DO NOTHING;
  END LOOP;
  
  FOR rec IN SELECT * FROM find_drivers_by_route(freight_uuid) LOOP
    INSERT INTO freight_matches (
      freight_id, driver_id, driver_area_id, match_type, distance_m, match_score
    ) VALUES (
      freight_uuid, 
      rec.driver_id, 
      rec.driver_area_id, 
      CASE 
        WHEN rec.match_method = 'ROUTE_GEOGRAPHIC' THEN 'ROUTE'
        WHEN rec.match_method = 'CITY_ROUTE' THEN 'BOTH'
        ELSE 'ROUTE'
      END,
      rec.distance_to_route_m,
      CASE 
        WHEN rec.match_method = 'ROUTE_GEOGRAPHIC' AND rec.distance_to_route_m IS NOT NULL 
          THEN GREATEST(0.1, 1.0 - (rec.distance_to_route_m / (rec.radius_km * 1000)))
        WHEN rec.match_method = 'CITY_ROUTE' THEN 0.85
        ELSE 0.5
      END
    ) ON CONFLICT (freight_id, driver_id, driver_area_id) DO NOTHING;
  END LOOP;
  
  RETURN QUERY
  SELECT 
    fm.driver_id,
    fm.driver_area_id,
    fm.match_type,
    fm.distance_m,
    fm.match_score
  FROM freight_matches fm
  WHERE fm.freight_id = freight_uuid
  ORDER BY fm.match_score DESC, fm.distance_m ASC NULLS LAST;
END;
$function$;

-- 1.6 Função: find_providers_by_service_and_location
CREATE OR REPLACE FUNCTION public.find_providers_by_service_and_location(request_id uuid, request_lat numeric, request_lng numeric, required_service_type text)
RETURNS TABLE(provider_id uuid, provider_area_id uuid, distance_m numeric, city_name text, radius_km numeric, service_types text[], service_match boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    spa.provider_id,
    spa.id AS provider_area_id,
    extensions.ST_Distance(
      spa.geom::extensions.geography, 
      extensions.ST_SetSRID(extensions.ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::extensions.geography
    )::numeric AS distance_m,
    spa.city_name,
    spa.radius_km,
    spa.service_types,
    (required_service_type = ANY(spa.service_types)) AS service_match
  FROM service_provider_areas spa
  WHERE spa.is_active = true
    AND extensions.ST_DWithin(
      spa.geom::extensions.geography, 
      extensions.ST_SetSRID(extensions.ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::extensions.geography,
      COALESCE(spa.radius_m, spa.radius_km * 1000)::double precision
    )
    AND (
      array_length(spa.service_types, 1) IS NULL
      OR required_service_type = ANY(spa.service_types)
    )
  ORDER BY 
    service_match DESC,
    distance_m ASC;
END;
$function$;

-- 1.7 Trigger: update_service_area_polygon
CREATE OR REPLACE FUNCTION public.update_service_area_polygon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  NEW.service_area := extensions.ST_Buffer(
    extensions.ST_Transform(NEW.geom::geometry, 3857), 
    NEW.radius_m
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 1.8 Trigger: update_provider_service_area_polygon
CREATE OR REPLACE FUNCTION public.update_provider_service_area_polygon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  NEW.service_area := extensions.ST_Buffer(
    extensions.ST_Transform(NEW.geom::geometry, 3857), 
    NEW.radius_m
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 1.9 Trigger: update_producer_service_area_geom
CREATE OR REPLACE FUNCTION public.update_producer_service_area_geom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  NEW.geom = extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$function$;

-- 2. TRIGGERS PARA HIDRATAR CAMPOS GEOMÉTRICOS AUTOMATICAMENTE
-- =====================================================

-- 2.1 Trigger para driver_service_areas
CREATE OR REPLACE FUNCTION public.ensure_driver_service_area_geom()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  -- Garantir geom a partir de lat/lng
  NEW.geom := extensions.ST_SetSRID(
    extensions.ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision),
    4326
  );
  
  -- Garantir radius_m
  NEW.radius_m := COALESCE(NEW.radius_m, NEW.radius_km * 1000);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_driver_service_area_geom_trigger ON driver_service_areas;
CREATE TRIGGER ensure_driver_service_area_geom_trigger
  BEFORE INSERT OR UPDATE ON driver_service_areas
  FOR EACH ROW
  EXECUTE FUNCTION ensure_driver_service_area_geom();

-- 2.2 Trigger para freights
CREATE OR REPLACE FUNCTION public.ensure_freight_geog()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  IF NEW.origin_lat IS NOT NULL AND NEW.origin_lng IS NOT NULL THEN
    NEW.origin_geog := extensions.ST_SetSRID(
      extensions.ST_MakePoint(NEW.origin_lng::double precision, NEW.origin_lat::double precision),
      4326
    )::extensions.geography;
  END IF;
  
  IF NEW.destination_lat IS NOT NULL AND NEW.destination_lng IS NOT NULL THEN
    NEW.destination_geog := extensions.ST_SetSRID(
      extensions.ST_MakePoint(NEW.destination_lng::double precision, NEW.destination_lat::double precision),
      4326
    )::extensions.geography;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_freight_geog_trigger ON freights;
CREATE TRIGGER ensure_freight_geog_trigger
  BEFORE INSERT OR UPDATE ON freights
  FOR EACH ROW
  EXECUTE FUNCTION ensure_freight_geog();

-- 3. CONSTRAINT CORRETA EM freight_matches
-- =====================================================

ALTER TABLE freight_matches DROP CONSTRAINT IF EXISTS freight_matches_unique;
ALTER TABLE freight_matches ADD CONSTRAINT freight_matches_unique 
  UNIQUE (freight_id, driver_id, driver_area_id);

-- 4. ÍNDICES GIST PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_freights_origin_geog 
  ON freights USING GIST(origin_geog);

CREATE INDEX IF NOT EXISTS idx_driver_service_areas_geom 
  ON driver_service_areas USING GIST(geom);