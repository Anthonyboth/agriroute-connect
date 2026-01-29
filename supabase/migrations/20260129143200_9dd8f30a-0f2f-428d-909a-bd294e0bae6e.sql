-- Create table to expose ONLY current GPS fields (avoid SELECT on full profiles table)
CREATE TABLE IF NOT EXISTS public.driver_current_locations (
  driver_profile_id UUID PRIMARY KEY,
  lat DOUBLE PRECISION NULL,
  lng DOUBLE PRECISION NULL,
  last_gps_update TIMESTAMP WITH TIME ZONE NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_current_locations ENABLE ROW LEVEL SECURITY;

-- Only the driver (by auth.uid mapped via profiles.user_id) can read their own current location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'driver_current_locations'
      AND policyname = 'driver_current_locations_select_own'
  ) THEN
    CREATE POLICY driver_current_locations_select_own
    ON public.driver_current_locations
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = driver_current_locations.driver_profile_id
          AND p.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Sync function: whenever profiles location changes, upsert into driver_current_locations.
-- SECURITY DEFINER is used so it can write even when the caller cannot INSERT/UPDATE into the table.
CREATE OR REPLACE FUNCTION public.sync_driver_current_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.driver_current_locations (
    driver_profile_id,
    lat,
    lng,
    last_gps_update,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.current_location_lat,
    NEW.current_location_lng,
    NEW.last_gps_update,
    now()
  )
  ON CONFLICT (driver_profile_id)
  DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    last_gps_update = EXCLUDED.last_gps_update,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_driver_current_location ON public.profiles;
CREATE TRIGGER trigger_sync_driver_current_location
AFTER UPDATE OF current_location_lat, current_location_lng, last_gps_update
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_driver_current_location();

-- Backfill (non-destructive): populate table with any existing stored location
INSERT INTO public.driver_current_locations (
  driver_profile_id,
  lat,
  lng,
  last_gps_update,
  updated_at
)
SELECT
  p.id,
  p.current_location_lat,
  p.current_location_lng,
  p.last_gps_update,
  now()
FROM public.profiles p
WHERE p.current_location_lat IS NOT NULL
  AND p.current_location_lng IS NOT NULL
ON CONFLICT (driver_profile_id)
DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  last_gps_update = EXCLUDED.last_gps_update,
  updated_at = now();
