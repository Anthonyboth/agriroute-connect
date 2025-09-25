-- Update existing freights with null minimum_antt_price by calculating them
CREATE OR REPLACE FUNCTION calculate_antt_minimum_price(
  cargo_type_param TEXT,
  weight_kg NUMERIC,
  distance_km NUMERIC,
  origin_state TEXT,
  destination_state TEXT
) RETURNS NUMERIC AS $$
DECLARE
  base_rate_per_km NUMERIC := 2.50; -- fallback default
  cargo_multiplier NUMERIC := 1.2; -- fallback default
  weight_factor NUMERIC;
  interstate_fee NUMERIC;
  distance_discount NUMERIC;
  antt_reference_price NUMERIC;
  minimum_freight_value NUMERIC;
  price_data RECORD;
BEGIN
  -- Try to get pricing from database first
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
    -- Fallback to hardcoded multipliers based on cargo type
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
  
  -- Fator de peso (quanto mais pesado, maior o valor por km)
  IF weight_kg <= 15000 THEN
    weight_factor := 1.0;
  ELSIF weight_kg <= 25000 THEN
    weight_factor := 1.2;
  ELSE
    weight_factor := 1.4;
  END IF;
  
  -- Taxa interestadual
  IF origin_state != destination_state THEN
    interstate_fee := 0.15;
  ELSE
    interstate_fee := 0;
  END IF;
  
  -- Desconto por distância (viagens longas têm desconto progressivo)
  IF distance_km > 800 THEN
    distance_discount := 0.85;
  ELSIF distance_km > 500 THEN
    distance_discount := 0.9;
  ELSE
    distance_discount := 1.0;
  END IF;
  
  -- Cálculo final
  base_rate_per_km := base_rate_per_km * weight_factor * cargo_multiplier * distance_discount;
  
  antt_reference_price := ROUND(distance_km * (base_rate_per_km + interstate_fee) * 100) / 100;
  minimum_freight_value := ROUND(antt_reference_price * 0.95 * 100) / 100; -- 5% abaixo da referência
  
  RETURN minimum_freight_value;
END;
$$ LANGUAGE plpgsql;

-- Update existing freights that have null minimum_antt_price
UPDATE freights 
SET minimum_antt_price = calculate_antt_minimum_price(
  cargo_type, 
  weight, 
  COALESCE(distance_km, 100), -- Use 100km as default if distance is null
  COALESCE(origin_state, 'SP'), -- Default to SP if null
  COALESCE(destination_state, 'RJ') -- Default to RJ if null
)
WHERE minimum_antt_price IS NULL AND distance_km IS NOT NULL;