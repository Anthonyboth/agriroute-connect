
-- ============================================
-- Fix: Trigger agora SEMPRE valida que city_id corresponde ao nome da cidade.
-- Se houver mismatch (city_id aponta para cidade X mas origin_city diz Y),
-- o trigger corrige automaticamente para o ID correto.
-- Isso IMPEDE que city_ids errados sejam persistidos, independente do frontend.
-- ============================================

CREATE OR REPLACE FUNCTION public.backfill_freight_city_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_resolved_origin_id uuid;
  v_resolved_dest_id uuid;
BEGIN
  -- SEMPRE resolver origin_city_id a partir do nome da cidade
  -- Isso garante que mesmo se o frontend enviar um ID errado, será corrigido
  IF (NEW.origin_city IS NOT NULL AND NEW.origin_state IS NOT NULL) THEN
    SELECT c.id INTO v_resolved_origin_id
    FROM cities c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.origin_city))
      AND UPPER(TRIM(c.state)) = UPPER(TRIM(NEW.origin_state))
    LIMIT 1;
    
    -- Se encontrou uma cidade válida, SEMPRE usa o ID correto
    IF v_resolved_origin_id IS NOT NULL THEN
      NEW.origin_city_id := v_resolved_origin_id;
    END IF;
  END IF;

  -- SEMPRE resolver destination_city_id a partir do nome da cidade
  IF (NEW.destination_city IS NOT NULL AND NEW.destination_state IS NOT NULL) THEN
    SELECT c.id INTO v_resolved_dest_id
    FROM cities c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(NEW.destination_city))
      AND UPPER(TRIM(c.state)) = UPPER(TRIM(NEW.destination_state))
    LIMIT 1;
    
    IF v_resolved_dest_id IS NOT NULL THEN
      NEW.destination_city_id := v_resolved_dest_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.backfill_freight_city_ids() IS 
'SEMPRE resolve origin_city_id e destination_city_id a partir dos campos de texto origin_city/state, garantindo integridade mesmo se o frontend enviar IDs incorretos. Corrige mismatches automaticamente.';
