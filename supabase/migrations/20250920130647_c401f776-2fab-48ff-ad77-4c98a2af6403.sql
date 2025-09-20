-- Service Provider Spatial Matching System
-- Similar to freight matching but for service requests

-- Service provider areas table (multiple areas per provider)
CREATE TABLE public.service_provider_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  city_name text NOT NULL,
  state text,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  radius_km numeric(6,2) NOT NULL DEFAULT 50,
  service_types text[] DEFAULT ARRAY[]::text[], -- Types of services offered in this area
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Spatial columns
  geom geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
  ) STORED,
  
  radius_m numeric(10,2) GENERATED ALWAYS AS (radius_km * 1000) STORED,
  
  -- Precomputed service area polygon for performance
  service_area geometry(POLYGON, 3857),
  
  -- Foreign key to profiles table
  CONSTRAINT fk_service_provider_areas_provider 
    FOREIGN KEY (provider_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.service_provider_areas ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_provider_areas
CREATE POLICY "Providers can manage their own service areas" 
ON public.service_provider_areas
FOR ALL
USING (provider_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (provider_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "Authenticated users can view active service areas"
ON public.service_provider_areas  
FOR SELECT
USING (is_active = true);

-- Spatial indexes for performance
CREATE INDEX idx_service_provider_areas_geom ON public.service_provider_areas USING GIST (geom);
CREATE INDEX idx_service_provider_areas_service_area ON public.service_provider_areas USING GIST (service_area);
CREATE INDEX idx_service_provider_areas_provider_id ON public.service_provider_areas (provider_id);
CREATE INDEX idx_service_provider_areas_active ON public.service_provider_areas (is_active) WHERE is_active = true;
CREATE INDEX idx_service_provider_areas_service_types ON public.service_provider_areas USING GIN (service_types);

-- Service matches table for audit and performance tracking
CREATE TABLE public.service_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  provider_area_id uuid NOT NULL REFERENCES public.service_provider_areas(id),
  match_type text NOT NULL CHECK (match_type IN ('LOCATION', 'SERVICE_TYPE', 'BOTH')),
  distance_m numeric(10,2),
  match_score numeric(3,2) DEFAULT 1.0,
  service_compatibility_score numeric(3,2) DEFAULT 1.0,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate matches
  UNIQUE(service_request_id, provider_id, provider_area_id)
);

-- Enable RLS
ALTER TABLE public.service_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_matches
CREATE POLICY "Users can view matches for their requests or as matched providers"
ON public.service_matches
FOR SELECT  
USING (
  service_request_id IN (
    SELECT sr.id FROM public.service_requests sr 
    JOIN public.profiles p ON sr.client_id = p.id
    WHERE p.user_id = auth.uid()
  )
  OR service_request_id IN (
    SELECT gr.id FROM public.guest_requests gr 
    WHERE gr.request_type = 'SERVICE'
  )
  OR provider_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR is_admin()
);

CREATE POLICY "System can manage service matches"
ON public.service_matches
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_service_matches_service_request_id ON public.service_matches (service_request_id);
CREATE INDEX idx_service_matches_provider_id ON public.service_matches (provider_id);
CREATE INDEX idx_service_matches_created_at ON public.service_matches (created_at DESC);

-- Provider notification throttling table
CREATE TABLE public.provider_notification_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  notification_count integer DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  max_notifications_per_hour integer DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(provider_id)
);

-- Enable RLS
ALTER TABLE public.provider_notification_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for provider_notification_limits  
CREATE POLICY "Providers can view their own notification limits"
ON public.provider_notification_limits
FOR SELECT
USING (provider_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "System can manage provider notification limits" 
ON public.provider_notification_limits
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX idx_provider_notification_limits_provider_id ON public.provider_notification_limits (provider_id);

-- Function to update service area polygon when lat/lng/radius changes
CREATE OR REPLACE FUNCTION update_provider_service_area_polygon()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Convert to Web Mercator (3857) for accurate buffer calculation
  NEW.service_area := ST_Buffer(
    ST_Transform(NEW.geom::geometry, 3857), 
    NEW.radius_m
  );
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update service area polygon
CREATE TRIGGER trigger_update_provider_service_area_polygon
  BEFORE INSERT OR UPDATE OF lat, lng, radius_km 
  ON public.service_provider_areas
  FOR EACH ROW 
  EXECUTE FUNCTION update_provider_service_area_polygon();

-- Function to find providers by service request location
CREATE OR REPLACE FUNCTION public.find_providers_by_location(request_id uuid, request_lat numeric, request_lng numeric)
RETURNS TABLE (
  provider_id uuid,
  provider_area_id uuid,
  distance_m numeric,
  city_name text,
  radius_km numeric,
  service_types text[]
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  request_point geography;
BEGIN
  -- Create geography point from coordinates
  request_point := ST_SetSRID(ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::geography;
  
  RETURN QUERY
  SELECT 
    spa.provider_id,
    spa.id AS provider_area_id,
    ST_Distance(spa.geom, request_point)::numeric AS distance_m,
    spa.city_name,
    spa.radius_km,
    spa.service_types
  FROM service_provider_areas spa
  WHERE spa.is_active = true
    AND ST_DWithin(spa.geom, request_point, spa.radius_m)
  ORDER BY distance_m;
END;
$$;

-- Function to find providers by service type and location
CREATE OR REPLACE FUNCTION public.find_providers_by_service_and_location(
  request_id uuid, 
  request_lat numeric, 
  request_lng numeric,
  required_service_type text
)
RETURNS TABLE (
  provider_id uuid,
  provider_area_id uuid,
  distance_m numeric,
  city_name text,
  radius_km numeric,
  service_types text[],
  service_match boolean
)
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  request_point geography;
BEGIN
  -- Create geography point from coordinates
  request_point := ST_SetSRID(ST_MakePoint(request_lng::double precision, request_lat::double precision), 4326)::geography;
  
  RETURN QUERY
  SELECT 
    spa.provider_id,
    spa.id AS provider_area_id,
    ST_Distance(spa.geom, request_point)::numeric AS distance_m,
    spa.city_name,
    spa.radius_km,
    spa.service_types,
    (required_service_type = ANY(spa.service_types)) AS service_match
  FROM service_provider_areas spa
  WHERE spa.is_active = true
    AND ST_DWithin(spa.geom, request_point, spa.radius_m)
    AND (
      array_length(spa.service_types, 1) IS NULL -- No service type restrictions
      OR required_service_type = ANY(spa.service_types) -- Matches required service
    )
  ORDER BY 
    service_match DESC, -- Service matches first
    distance_m ASC; -- Then by proximity
END;
$$;

-- Function to execute complete service matching
CREATE OR REPLACE FUNCTION public.execute_service_matching(
  p_service_request_id uuid,
  p_request_lat numeric,
  p_request_lng numeric,
  p_service_type text DEFAULT NULL
)
RETURNS TABLE (
  provider_id uuid,
  provider_area_id uuid,
  match_type text,
  distance_m numeric,
  match_score numeric,
  service_compatibility_score numeric
)
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Clear existing matches for this service request
  DELETE FROM service_matches WHERE service_request_id = p_service_request_id;
  
  -- Find providers by location and service type
  FOR rec IN 
    SELECT * FROM find_providers_by_service_and_location(
      p_service_request_id, 
      p_request_lat, 
      p_request_lng, 
      p_service_type
    ) 
  LOOP
    INSERT INTO service_matches (
      service_request_id, 
      provider_id, 
      provider_area_id, 
      match_type, 
      distance_m, 
      match_score,
      service_compatibility_score
    ) VALUES (
      p_service_request_id, 
      rec.provider_id, 
      rec.provider_area_id, 
      CASE 
        WHEN rec.service_match THEN 'BOTH'
        ELSE 'LOCATION'
      END,
      rec.distance_m,
      GREATEST(0.1, 1.0 - (rec.distance_m / (rec.radius_km * 1000))), -- Distance score
      CASE WHEN rec.service_match THEN 1.0 ELSE 0.5 END -- Service compatibility score
    ) ON CONFLICT (service_request_id, provider_id, provider_area_id) DO NOTHING;
  END LOOP;
  
  -- Return all matches
  RETURN QUERY
  SELECT 
    sm.provider_id,
    sm.provider_area_id,
    sm.match_type,
    sm.distance_m,
    sm.match_score,
    sm.service_compatibility_score
  FROM service_matches sm
  WHERE sm.service_request_id = p_service_request_id
  ORDER BY 
    sm.service_compatibility_score DESC,
    sm.match_score DESC, 
    sm.distance_m ASC;
END;
$$;

-- Function to check provider notification throttling
CREATE OR REPLACE FUNCTION public.can_notify_provider(p_provider_id uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count integer;
  max_count integer;
  window_start timestamptz;
BEGIN
  -- Get current notification status
  SELECT 
    notification_count, 
    max_notifications_per_hour,
    window_start
  INTO current_count, max_count, window_start
  FROM provider_notification_limits 
  WHERE provider_id = p_provider_id;
  
  -- If no record exists, create one and allow notification
  IF NOT FOUND THEN
    INSERT INTO provider_notification_limits (provider_id, notification_count)
    VALUES (p_provider_id, 1);
    RETURN true;
  END IF;
  
  -- Reset counter if window expired (1 hour)
  IF window_start < now() - interval '1 hour' THEN
    UPDATE provider_notification_limits 
    SET notification_count = 1, 
        window_start = now(),
        updated_at = now()
    WHERE provider_id = p_provider_id;
    RETURN true;
  END IF;
  
  -- Check if under limit
  IF current_count < max_count THEN
    UPDATE provider_notification_limits 
    SET notification_count = notification_count + 1,
        updated_at = now()
    WHERE provider_id = p_provider_id;
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;