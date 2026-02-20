-- Trigger para auto-preencher city_id em service_requests quando city_name e state estão preenchidos mas city_id está NULL
CREATE OR REPLACE FUNCTION public.backfill_service_request_city_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se city_id está NULL mas temos city_name e state, tentar preencher
  IF NEW.city_id IS NULL AND NEW.city_name IS NOT NULL AND NEW.state IS NOT NULL THEN
    SELECT id INTO NEW.city_id
    FROM public.cities
    WHERE LOWER(name) = LOWER(NEW.city_name)
      AND LOWER(state) = LOWER(NEW.state)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger no INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_backfill_city_id ON public.service_requests;
CREATE TRIGGER trg_backfill_city_id
  BEFORE INSERT OR UPDATE OF city_name, state ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.backfill_service_request_city_id();

-- Backfill retroativo para registros existentes com city_id NULL
UPDATE public.service_requests sr
SET city_id = c.id
FROM public.cities c
WHERE sr.city_id IS NULL
  AND sr.city_name IS NOT NULL
  AND sr.state IS NOT NULL
  AND LOWER(c.name) = LOWER(sr.city_name)
  AND LOWER(c.state) = LOWER(sr.state);