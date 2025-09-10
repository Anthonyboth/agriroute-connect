-- Corrigir função update_freight_status para ter search_path seguro
CREATE OR REPLACE FUNCTION update_freight_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar o status principal do frete
  UPDATE public.freights 
  SET status = NEW.status::freight_status,
      current_lat = NEW.location_lat,
      current_lng = NEW.location_lng,
      last_location_update = NEW.created_at
  WHERE id = NEW.freight_id;
  
  RETURN NEW;
END;
$$;