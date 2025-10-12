-- FASE 1: Estrutura Hierárquica de Cidades

-- Temporariamente simplificar validação
CREATE OR REPLACE FUNCTION validate_freight_input()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price IS NOT NULL AND (NEW.price < 1 OR NEW.price > 1000000) THEN
    RAISE EXCEPTION 'Preço deve estar entre R$ 1 e R$ 1.000.000';
  END IF;
  IF NEW.weight IS NOT NULL AND (NEW.weight < 0.1) THEN
    RAISE EXCEPTION 'Peso deve ser maior ou igual a 0.1 kg';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar colunas
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_city_id UUID REFERENCES cities(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address_city_id UUID REFERENCES cities(id);
ALTER TABLE freights ADD COLUMN IF NOT EXISTS origin_city_id UUID REFERENCES cities(id);
ALTER TABLE freights ADD COLUMN IF NOT EXISTS destination_city_id UUID REFERENCES cities(id);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);
ALTER TABLE driver_availability ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

-- Migrar dados
UPDATE profiles p SET base_city_id = c.id FROM cities c
WHERE p.base_city_id IS NULL AND p.base_city_name IS NOT NULL AND p.base_state IS NOT NULL
  AND LOWER(TRIM(p.base_city_name)) = LOWER(TRIM(c.name)) AND LOWER(TRIM(p.base_state)) = LOWER(TRIM(c.state));

UPDATE freights f SET origin_city_id = c.id FROM cities c
WHERE f.origin_city_id IS NULL AND f.origin_city IS NOT NULL AND f.origin_state IS NOT NULL
  AND LOWER(TRIM(f.origin_city)) = LOWER(TRIM(c.name)) AND LOWER(TRIM(f.origin_state)) = LOWER(TRIM(c.state));

UPDATE freights f SET destination_city_id = c.id FROM cities c
WHERE f.destination_city_id IS NULL AND f.destination_city IS NOT NULL AND f.destination_state IS NOT NULL
  AND LOWER(TRIM(f.destination_city)) = LOWER(TRIM(c.name)) AND LOWER(TRIM(f.destination_state)) = LOWER(TRIM(c.state));

UPDATE service_requests sr SET city_id = c.id FROM cities c
WHERE sr.city_id IS NULL AND sr.city_name IS NOT NULL AND sr.state IS NOT NULL
  AND LOWER(TRIM(sr.city_name)) = LOWER(TRIM(c.name)) AND LOWER(TRIM(sr.state)) = LOWER(TRIM(c.state));

UPDATE driver_availability da SET city_id = c.id FROM cities c
WHERE da.city_id IS NULL AND da.city IS NOT NULL AND da.state IS NOT NULL
  AND LOWER(TRIM(da.city)) = LOWER(TRIM(c.name)) AND LOWER(TRIM(da.state)) = LOWER(TRIM(c.state));

-- Restaurar validação
CREATE OR REPLACE FUNCTION validate_freight_input()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price IS NOT NULL AND (NEW.price < 1 OR NEW.price > 1000000) THEN RAISE EXCEPTION 'Preço deve estar entre R$ 1 e R$ 1.000.000'; END IF;
  IF NEW.weight IS NOT NULL AND (NEW.weight < 0.1) THEN RAISE EXCEPTION 'Peso deve ser maior ou igual a 0.1 kg'; END IF;
  IF NEW.origin_address IS NOT NULL AND (length(NEW.origin_address) < 5 OR length(NEW.origin_address) > 500) THEN RAISE EXCEPTION 'Endereço de origem deve ter entre 5 e 500 caracteres'; END IF;
  IF NEW.destination_address IS NOT NULL AND (length(NEW.destination_address) < 5 OR length(NEW.destination_address) > 500) THEN RAISE EXCEPTION 'Endereço de destino deve ter entre 5 e 500 caracteres'; END IF;
  IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE THEN RAISE EXCEPTION 'Data de coleta deve ser futura'; END IF;
  IF NEW.delivery_date IS NOT NULL AND NEW.delivery_date < CURRENT_DATE THEN RAISE EXCEPTION 'Data de entrega deve ser futura'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_base_city ON profiles(base_city_id);
CREATE INDEX IF NOT EXISTS idx_profiles_address_city ON profiles(address_city_id);
CREATE INDEX IF NOT EXISTS idx_freights_origin_city ON freights(origin_city_id);
CREATE INDEX IF NOT EXISTS idx_freights_dest_city ON freights(destination_city_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_city ON service_requests(city_id);
CREATE INDEX IF NOT EXISTS idx_driver_availability_city ON driver_availability(city_id);

-- Funções RPC
CREATE OR REPLACE FUNCTION get_users_in_city(p_city_id UUID)
RETURNS TABLE(user_id UUID, full_name TEXT, role user_role, rating NUMERIC, city_name TEXT, city_state TEXT) 
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.id, p.full_name, p.role, p.rating, c.name, c.state FROM profiles p JOIN cities c ON p.base_city_id = c.id 
WHERE p.base_city_id = p_city_id AND p.status = 'APPROVED' ORDER BY p.full_name; $$;

CREATE OR REPLACE FUNCTION get_freights_in_city(p_city_id UUID, p_type TEXT DEFAULT 'all')
RETURNS TABLE(freight_id UUID, cargo_type TEXT, status freight_status, price NUMERIC, origin_city TEXT, origin_state TEXT, destination_city TEXT, destination_state TEXT, created_at TIMESTAMP WITH TIME ZONE) 
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT f.id, f.cargo_type, f.status, f.price, oc.name, oc.state, dc.name, dc.state, f.created_at FROM freights f
LEFT JOIN cities oc ON f.origin_city_id = oc.id LEFT JOIN cities dc ON f.destination_city_id = dc.id
WHERE (CASE WHEN p_type = 'origin' THEN f.origin_city_id = p_city_id WHEN p_type = 'destination' THEN f.destination_city_id = p_city_id
ELSE f.origin_city_id = p_city_id OR f.destination_city_id = p_city_id END) AND f.status IN ('OPEN', 'ACCEPTED', 'IN_TRANSIT') ORDER BY f.created_at DESC; $$;

CREATE OR REPLACE FUNCTION get_services_in_city(p_city_id UUID)
RETURNS TABLE(service_id UUID, service_type TEXT, status TEXT, estimated_price NUMERIC, city_name TEXT, city_state TEXT, created_at TIMESTAMP WITH TIME ZONE) 
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT sr.id, sr.service_type, sr.status, sr.estimated_price, c.name, c.state, sr.created_at FROM service_requests sr
JOIN cities c ON sr.city_id = c.id WHERE sr.city_id = p_city_id AND sr.status = 'OPEN' ORDER BY sr.created_at DESC; $$;

CREATE OR REPLACE FUNCTION find_drivers_by_origin(freight_uuid UUID)
RETURNS TABLE(driver_id UUID, driver_area_id UUID, distance_m NUMERIC, city_name TEXT, radius_km NUMERIC, match_method TEXT)
LANGUAGE PLPGSQL STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE freight_rec RECORD;
BEGIN
  SELECT f.origin_geog, f.origin_lat, f.origin_lng, f.origin_city_id, c.name as origin_city_name, c.state as origin_state
  INTO freight_rec FROM freights f LEFT JOIN cities c ON f.origin_city_id = c.id WHERE f.id = freight_uuid;
  IF freight_rec.origin_lat IS NOT NULL AND freight_rec.origin_lng IS NOT NULL THEN
    RETURN QUERY SELECT uc.user_id, uc.id,
      extensions.ST_Distance(extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        freight_rec.origin_geog::extensions.geography)::numeric, c.name, uc.radius_km, 'GEOGRAPHIC'::text
    FROM user_cities uc JOIN cities c ON uc.city_id = c.id JOIN profiles p ON uc.user_id = p.id
    WHERE uc.is_active = true AND uc.type = 'MOTORISTA_ORIGEM' AND p.role = 'MOTORISTA' AND p.status = 'APPROVED' AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      AND extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(c.lng::double precision, c.lat::double precision), 4326)::extensions.geography,
        freight_rec.origin_geog::extensions.geography, uc.radius_km * 1000) ORDER BY 3;
  ELSIF freight_rec.origin_city_id IS NOT NULL THEN
    RETURN QUERY SELECT uc.user_id, uc.id, NULL::numeric, c.name, uc.radius_km, 'CITY_MATCH'::text
    FROM user_cities uc JOIN cities c ON uc.city_id = c.id JOIN profiles p ON uc.user_id = p.id
    WHERE uc.is_active = true AND uc.type = 'MOTORISTA_ORIGEM' AND p.role = 'MOTORISTA' AND p.status = 'APPROVED' AND uc.city_id = freight_rec.origin_city_id
    ORDER BY c.name;
  END IF;
END; $$;

CREATE OR REPLACE VIEW city_hierarchy AS
SELECT c.id as city_id, c.name as city_name, c.state as city_state, c.lat, c.lng,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'APPROVED') as total_users,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'MOTORISTA' AND p.status = 'APPROVED') as total_drivers,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'PRODUTOR' AND p.status = 'APPROVED') as total_producers,
  COUNT(DISTINCT p.id) FILTER (WHERE p.role = 'PRESTADOR_SERVICOS' AND p.status = 'APPROVED') as total_providers,
  COUNT(DISTINCT f.id) FILTER (WHERE f.status IN ('OPEN','ACCEPTED','IN_TRANSIT')) as active_freights_origin,
  COUNT(DISTINCT fd.id) FILTER (WHERE fd.status IN ('OPEN','ACCEPTED','IN_TRANSIT')) as active_freights_destination,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'OPEN') as active_services
FROM cities c
LEFT JOIN profiles p ON p.base_city_id = c.id
LEFT JOIN freights f ON f.origin_city_id = c.id
LEFT JOIN freights fd ON fd.destination_city_id = c.id
LEFT JOIN service_requests sr ON sr.city_id = c.id
GROUP BY c.id, c.name, c.state, c.lat, c.lng;