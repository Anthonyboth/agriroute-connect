-- Fix invalid timestamp concatenation in payment deadline function
CREATE OR REPLACE FUNCTION public.create_payment_deadline_on_accept()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only when status transitions to ACCEPTED
  IF NEW.status = 'ACCEPTED' AND (OLD.status IS NULL OR OLD.status <> 'ACCEPTED') THEN
    -- Guard: if pickup_date is null, skip to avoid invalid timestamp
    IF NEW.pickup_date IS NULL THEN
      RETURN NEW;
    END IF;

    -- Create or update payment deadline at 09:00 of the pickup_date (TZ-safe)
    INSERT INTO freight_payment_deadlines (
      freight_id,
      deadline_at,
      minimum_amount,
      status
    ) VALUES (
      NEW.id,
      date_trunc('day', NEW.pickup_date::timestamptz) + interval '9 hours',
      NEW.price * 0.5,
      'PENDING'
    ) ON CONFLICT (freight_id) DO UPDATE SET
      deadline_at = date_trunc('day', NEW.pickup_date::timestamptz) + interval '9 hours',
      minimum_amount = NEW.price * 0.5,
      status = 'PENDING',
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$function$;