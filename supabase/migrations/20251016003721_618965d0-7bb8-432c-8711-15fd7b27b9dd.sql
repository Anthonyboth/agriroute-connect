-- Trigger para garantir consistência de preços por carreta
CREATE OR REPLACE FUNCTION validate_freight_price_per_truck()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tem required_trucks > 1, price deve refletir o total
  IF NEW.required_trucks > 1 AND NEW.price IS NOT NULL THEN
    -- Adicionar no metadata o preço por carreta para auditoria
    NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || 
      jsonb_build_object(
        'price_per_truck', NEW.price / NEW.required_trucks,
        'total_trucks', NEW.required_trucks,
        'validation_timestamp', now()
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para freights
DROP TRIGGER IF EXISTS validate_freight_prices ON freights;
CREATE TRIGGER validate_freight_prices
  BEFORE INSERT OR UPDATE ON freights
  FOR EACH ROW
  EXECUTE FUNCTION validate_freight_price_per_truck();