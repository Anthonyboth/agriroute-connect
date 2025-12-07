-- Fix functions without search_path set (Security: Prevent search path injection)
-- This addresses the SUPA_function_search_path_mutable linter warning

-- 1. Fix calculate_antt_minimum_price
CREATE OR REPLACE FUNCTION public.calculate_antt_minimum_price(cargo_type_param text, weight_kg numeric, distance_km numeric, origin_state text, destination_state text)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  base_rate_per_km NUMERIC := 2.50;
  cargo_multiplier NUMERIC := 1.2;
  weight_factor NUMERIC;
  interstate_fee NUMERIC;
  distance_discount NUMERIC;
  antt_reference_price NUMERIC;
  minimum_freight_value NUMERIC;
  price_data RECORD;
BEGIN
  SELECT * INTO price_data 
  FROM antt_freight_prices 
  WHERE service_type = cargo_type_param 
    AND distance_range_min <= distance_km 
    AND (distance_range_max >= distance_km OR distance_range_max IS NULL)
  ORDER BY distance_range_min DESC 
  LIMIT 1;
  
  IF FOUND THEN
    base_rate_per_km := price_data.price_per_km;
  ELSE
    CASE cargo_type_param
      WHEN 'GRAO_SOJA', 'graos_soja', 'graos', 'MILHO' THEN cargo_multiplier := 1.0;
      WHEN 'adubo_fertilizante', 'fertilizantes' THEN cargo_multiplier := 1.1;
      WHEN 'combustivel' THEN cargo_multiplier := 1.4;
      WHEN 'produtos_quimicos' THEN cargo_multiplier := 1.5;
      WHEN 'sementes_bags', 'carga_geral' THEN cargo_multiplier := 1.2;
      WHEN 'refrigerados' THEN cargo_multiplier := 1.3;
      WHEN 'containers' THEN cargo_multiplier := 1.1;
      ELSE cargo_multiplier := 1.2;
    END CASE;
  END IF;
  
  IF weight_kg <= 15000 THEN
    weight_factor := 1.0;
  ELSIF weight_kg <= 25000 THEN
    weight_factor := 1.2;
  ELSE
    weight_factor := 1.4;
  END IF;
  
  IF origin_state != destination_state THEN
    interstate_fee := 0.15;
  ELSE
    interstate_fee := 0;
  END IF;
  
  IF distance_km > 800 THEN
    distance_discount := 0.85;
  ELSIF distance_km > 500 THEN
    distance_discount := 0.9;
  ELSE
    distance_discount := 1.0;
  END IF;
  
  base_rate_per_km := base_rate_per_km * weight_factor * cargo_multiplier * distance_discount;
  antt_reference_price := ROUND(distance_km * (base_rate_per_km + interstate_fee) * 100) / 100;
  minimum_freight_value := ROUND(antt_reference_price * 0.95 * 100) / 100;
  
  RETURN minimum_freight_value;
END;
$function$;

-- 2. Fix set_freight_template_updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_freight_template_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. Fix update_financial_transactions_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_financial_transactions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. Fix update_mdfe_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_mdfe_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 5. Fix update_user_devices_updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_user_devices_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 6. Fix validate_freight_input trigger function
CREATE OR REPLACE FUNCTION public.validate_freight_input()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.price IS NOT NULL AND (NEW.price < 1 OR NEW.price > 1000000) THEN 
    RAISE EXCEPTION 'Preço deve estar entre R$ 1 e R$ 1.000.000'; 
  END IF;
  
  IF NEW.weight IS NOT NULL AND (NEW.weight < 0.1) THEN 
    RAISE EXCEPTION 'Peso deve ser maior ou igual a 0.1 kg'; 
  END IF;
  
  IF NEW.origin_address IS NOT NULL AND (length(NEW.origin_address) < 5 OR length(NEW.origin_address) > 500) THEN 
    RAISE EXCEPTION 'Endereço de origem deve ter entre 5 e 500 caracteres'; 
  END IF;
  
  IF NEW.destination_address IS NOT NULL AND (length(NEW.destination_address) < 5 OR length(NEW.destination_address) > 500) THEN 
    RAISE EXCEPTION 'Endereço de destino deve ter entre 5 e 500 caracteres'; 
  END IF;
  
  IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE AND NEW.status NOT IN ('CANCELLED', 'DELIVERED', 'COMPLETED') THEN 
    RAISE EXCEPTION 'Data de coleta não pode ser no passado para fretes ativos'; 
  END IF;
  
  RETURN NEW;
END;
$function$;