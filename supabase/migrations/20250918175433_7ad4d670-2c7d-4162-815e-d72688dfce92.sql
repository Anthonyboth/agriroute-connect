-- Fix linter: set immutable search_path on trigger function we created
CREATE OR REPLACE FUNCTION public.sync_freight_on_proposal_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
    UPDATE public.freights 
    SET 
      driver_id = NEW.driver_id,
      status = 'ACCEPTED'::freight_status,
      updated_at = now()
    WHERE id = NEW.freight_id;
  END IF;
  RETURN NEW;
END;
$$;