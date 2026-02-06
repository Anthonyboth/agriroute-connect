
-- Fix trigger to handle guest freights where producer_id is NULL
CREATE OR REPLACE FUNCTION add_freight_chat_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only add producer if producer_id is NOT NULL (skip for guest freights)
  IF NEW.producer_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    VALUES (NEW.id, NEW.producer_id, 'PRODUCER')
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    SELECT NEW.id, tc.profile_id, 'COMPANY'
    FROM transport_companies tc
    WHERE tc.id = NEW.company_id
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    VALUES (NEW.id, NEW.driver_id, 'DRIVER')
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION add_freight_chat_participants IS 
'Adiciona participantes ao chat do frete. Pula producer_id quando NULL (fretes guest).';
