
-- ============================================
-- Trigger: auto-preenche origin_city_id e destination_city_id em fretes
-- quando inseridos/atualizados sem city_id mas com city name+state
-- ============================================

CREATE OR REPLACE FUNCTION public.backfill_freight_city_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Backfill origin_city_id
  IF (NEW.origin_city_id IS NULL AND NEW.origin_city IS NOT NULL AND NEW.origin_state IS NOT NULL) THEN
    SELECT c.id INTO NEW.origin_city_id
    FROM cities c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.origin_city))
      AND LOWER(TRIM(c.state)) = LOWER(TRIM(NEW.origin_state))
    LIMIT 1;
  END IF;

  -- Backfill destination_city_id
  IF (NEW.destination_city_id IS NULL AND NEW.destination_city IS NOT NULL AND NEW.destination_state IS NOT NULL) THEN
    SELECT c.id INTO NEW.destination_city_id
    FROM cities c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.destination_city))
      AND LOWER(TRIM(c.state)) = LOWER(TRIM(NEW.destination_state))
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger em INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_backfill_freight_city_ids ON public.freights;
CREATE TRIGGER trg_backfill_freight_city_ids
  BEFORE INSERT OR UPDATE ON public.freights
  FOR EACH ROW
  EXECUTE FUNCTION public.backfill_freight_city_ids();

-- Backfill imediato dos fretes existentes com city_id NULL
UPDATE freights f
SET origin_city_id = c.id
FROM cities c
WHERE f.origin_city_id IS NULL
  AND f.origin_city IS NOT NULL
  AND f.origin_state IS NOT NULL
  AND LOWER(TRIM(f.origin_city)) = LOWER(TRIM(c.name))
  AND LOWER(TRIM(f.origin_state)) = LOWER(TRIM(c.state));

UPDATE freights f
SET destination_city_id = c.id
FROM cities c
WHERE f.destination_city_id IS NULL
  AND f.destination_city IS NOT NULL
  AND f.destination_state IS NOT NULL
  AND LOWER(TRIM(f.destination_city)) = LOWER(TRIM(c.name))
  AND LOWER(TRIM(f.destination_state)) = LOWER(TRIM(c.state));

COMMENT ON FUNCTION public.backfill_freight_city_ids() IS 
'Auto-preenche origin_city_id e destination_city_id em fretes a partir dos campos de texto origin_city/state e destination_city/state, garantindo que o filtro de cidade no marketplace funcione corretamente.';
