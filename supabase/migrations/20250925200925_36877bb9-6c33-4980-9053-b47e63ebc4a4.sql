-- Fix remaining security policies that might not have been applied

-- Check and fix existing policies
SELECT 'Checking existing policies...' as status;

-- Create admin user after you sign up
-- You need to manually update your profile after running this:
-- UPDATE profiles SET role = 'ADMIN', status = 'APPROVED' WHERE user_id = 'your-user-id-here';

-- Add input validation triggers for critical tables
CREATE OR REPLACE FUNCTION public.validate_freight_input()
RETURNS trigger AS $$
BEGIN
  -- Validate price range
  IF NEW.price IS NOT NULL AND (NEW.price < 1 OR NEW.price > 1000000) THEN
    RAISE EXCEPTION 'Preço deve estar entre R$ 1 e R$ 1.000.000';
  END IF;
  
  -- Validate weight
  IF NEW.weight IS NOT NULL AND (NEW.weight < 0.1 OR NEW.weight > 100000) THEN
    RAISE EXCEPTION 'Peso deve estar entre 0.1 e 100.000 kg';
  END IF;
  
  -- Validate addresses (basic length check)
  IF NEW.origin_address IS NOT NULL AND (length(NEW.origin_address) < 5 OR length(NEW.origin_address) > 500) THEN
    RAISE EXCEPTION 'Endereço de origem deve ter entre 5 e 500 caracteres';
  END IF;
  
  IF NEW.destination_address IS NOT NULL AND (length(NEW.destination_address) < 5 OR length(NEW.destination_address) > 500) THEN
    RAISE EXCEPTION 'Endereço de destino deve ter entre 5 e 500 caracteres';
  END IF;
  
  -- Validate dates
  IF NEW.pickup_date IS NOT NULL AND NEW.pickup_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de coleta deve ser futura';
  END IF;
  
  IF NEW.delivery_date IS NOT NULL AND NEW.delivery_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Data de entrega deve ser futura';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation trigger to freights table
DROP TRIGGER IF EXISTS freight_input_validation ON public.freights;
CREATE TRIGGER freight_input_validation
  BEFORE INSERT OR UPDATE ON public.freights
  FOR EACH ROW EXECUTE FUNCTION public.validate_freight_input();

-- Add validation for profiles
CREATE OR REPLACE FUNCTION public.validate_profile_input()
RETURNS trigger AS $$
BEGIN
  -- Validate full_name length and format
  IF NEW.full_name IS NOT NULL AND (length(NEW.full_name) < 2 OR length(NEW.full_name) > 100) THEN
    RAISE EXCEPTION 'Nome deve ter entre 2 e 100 caracteres';
  END IF;
  
  -- Validate phone format
  IF NEW.phone IS NOT NULL AND NOT (NEW.phone ~ '^[\d\s\-\(\)\+]{10,15}$') THEN
    RAISE EXCEPTION 'Formato de telefone inválido';
  END IF;
  
  -- Validate document (CPF/CNPJ)
  IF NEW.document IS NOT NULL AND NOT (NEW.document ~ '^\d{11}$' OR NEW.document ~ '^\d{14}$') THEN
    RAISE EXCEPTION 'Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation trigger to profiles table
DROP TRIGGER IF EXISTS profile_input_validation ON public.profiles;
CREATE TRIGGER profile_input_validation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_input();