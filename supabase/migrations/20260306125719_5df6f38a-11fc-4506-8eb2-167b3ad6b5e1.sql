-- Fix the specific inconsistent freight: set status/driver_id to match the active assignment
DO $$
BEGIN
  PERFORM set_config('app.skip_recalc', 'true', true);
  
  UPDATE freights
  SET status = 'ACCEPTED', 
      driver_id = 'a22b811e-9ff1-435e-97bf-8d35c079d7ab',
      updated_at = now()
  WHERE id = '0a6e2d56-2b68-4de3-8eeb-f019240ca881'
    AND status = 'OPEN'
    AND driver_id IS NULL;
    
  PERFORM set_config('app.skip_recalc', '', true);
END $$;