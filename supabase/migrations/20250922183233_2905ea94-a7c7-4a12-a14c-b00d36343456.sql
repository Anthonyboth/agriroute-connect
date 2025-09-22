-- Corrigir função create_payment_deadline_on_accept para não tentar extrair hora de campo date
CREATE OR REPLACE FUNCTION public.create_payment_deadline_on_accept()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When freight status changes from not-ACCEPTED to ACCEPTED
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status != 'ACCEPTED') THEN
    -- Create payment deadline: 50% of freight value due by pickup_date at 9:00 AM
    INSERT INTO freight_payment_deadlines (
      freight_id,
      deadline_at,
      minimum_amount,
      status
    ) VALUES (
      NEW.id,
      (NEW.pickup_date || ' 09:00:00')::timestamp with time zone,
      NEW.price * 0.5,
      'PENDING'
    ) ON CONFLICT (freight_id) DO UPDATE SET
      deadline_at = (NEW.pickup_date || ' 09:00:00')::timestamp with time zone,
      minimum_amount = NEW.price * 0.5,
      status = 'PENDING',
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;