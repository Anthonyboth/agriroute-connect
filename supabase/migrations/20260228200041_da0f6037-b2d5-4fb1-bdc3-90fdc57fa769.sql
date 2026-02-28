
-- Fix auto_insert_city to normalize state to uppercase 2-char before inserting
CREATE OR REPLACE FUNCTION public.auto_insert_city(
  city_name TEXT,
  state_name TEXT,
  latitude NUMERIC DEFAULT NULL,
  longitude NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  city_id UUID;
  normalized_state TEXT;
BEGIN
  -- Normalize state to uppercase 2-char
  normalized_state := UPPER(TRIM(state_name));
  
  -- Validate state format
  IF LENGTH(normalized_state) != 2 THEN
    -- Invalid state, skip insert and return null
    RETURN NULL;
  END IF;

  -- Check if city already exists
  SELECT id INTO city_id 
  FROM cities 
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(city_name)) 
  AND state = normalized_state;
  
  -- If not exists, insert new city
  IF city_id IS NULL THEN
    INSERT INTO cities (name, state, lat, lng)
    VALUES (TRIM(city_name), normalized_state, latitude, longitude)
    RETURNING id INTO city_id;
  END IF;
  
  RETURN city_id;
END;
$$;
