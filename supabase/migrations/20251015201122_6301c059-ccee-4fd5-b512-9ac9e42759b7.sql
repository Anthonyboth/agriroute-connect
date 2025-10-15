-- 1) Fix ambiguous status reference in trigger function
CREATE OR REPLACE FUNCTION public.sync_accepted_trucks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_freight_id UUID;
  v_accepted_count INT;
  v_required_count INT;
  v_drivers UUID[];
  v_new_status freight_status;
BEGIN
  v_freight_id := COALESCE(NEW.freight_id, OLD.freight_id);
  
  SELECT 
    COUNT(*) FILTER (WHERE fa.status = 'ACCEPTED'), 
    array_agg(DISTINCT fa.driver_id) FILTER (WHERE fa.status = 'ACCEPTED'),
    f.required_trucks
  INTO v_accepted_count, v_drivers, v_required_count
  FROM freight_assignments fa
  JOIN freights f ON f.id = v_freight_id
  WHERE fa.freight_id = v_freight_id
  GROUP BY f.required_trucks;
  
  IF v_accepted_count >= v_required_count THEN
    v_new_status := 'IN_NEGOTIATION';
  ELSE
    v_new_status := 'OPEN';
  END IF;
  
  UPDATE freights
  SET 
    accepted_trucks = COALESCE(v_accepted_count, 0),
    drivers_assigned = COALESCE(v_drivers, ARRAY[]::UUID[]),
    status = CASE 
      WHEN status = 'OPEN' AND required_trucks > 1 THEN v_new_status
      ELSE status
    END,
    driver_id = CASE 
      WHEN required_trucks > 1 THEN NULL
      ELSE driver_id
    END
  WHERE id = v_freight_id
  AND required_trucks > 1
  AND (
    accepted_trucks IS DISTINCT FROM COALESCE(v_accepted_count, 0) 
    OR drivers_assigned IS DISTINCT FROM COALESCE(v_drivers, ARRAY[]::UUID[])
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2) Create utility function to ensure current user has required role
CREATE OR REPLACE FUNCTION public.ensure_current_user_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_roles(user_id, role)
  VALUES (auth.uid(), _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

-- 3) Harden RLS for flexible_freight_proposals
DROP POLICY IF EXISTS "Only autonomous drivers can create flexible proposals" ON public.flexible_freight_proposals;
DROP POLICY IF EXISTS "Drivers can create flexible proposals" ON public.flexible_freight_proposals;

CREATE POLICY "Only autonomous drivers can create flexible proposals"
ON public.flexible_freight_proposals
FOR INSERT
TO authenticated
WITH CHECK (
  driver_id IN (
    SELECT p.id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'MOTORISTA'
  )
  AND public.has_role(auth.uid(), 'driver'::app_role)
);

-- 4) Harden RLS for freight_proposals (if table exists)
DROP POLICY IF EXISTS "Only autonomous drivers can create proposals" ON public.freight_proposals;
DROP POLICY IF EXISTS "Drivers can create proposals" ON public.freight_proposals;

CREATE POLICY "Only autonomous drivers can create proposals"
ON public.freight_proposals
FOR INSERT
TO authenticated
WITH CHECK (
  driver_id IN (
    SELECT p.id
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'MOTORISTA'
  )
  AND public.has_role(auth.uid(), 'driver'::app_role)
);