-- Corrigir warning de Function Search Path Mutable
-- Recriar a função update_tracking_updated_at_column com search_path seguro
DROP FUNCTION IF EXISTS public.update_tracking_updated_at_column();

CREATE OR REPLACE FUNCTION public.update_tracking_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;