-- Create function to sanitize document (remove non-digits)
CREATE OR REPLACE FUNCTION public.sanitize_document(doc TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN regexp_replace(doc, '\D', '', 'g');
END;
$$;

-- Create trigger function to sanitize documents before insert/update
CREATE OR REPLACE FUNCTION public.sanitize_document_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sanitize document column if exists
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.document IS NOT NULL THEN
      NEW.document := public.sanitize_document(NEW.document);
    END IF;
    IF NEW.cpf_cnpj IS NOT NULL THEN
      NEW.cpf_cnpj := public.sanitize_document(NEW.cpf_cnpj);
    END IF;
  END IF;
  
  -- Sanitize transport_companies CNPJ
  IF TG_TABLE_NAME = 'transport_companies' THEN
    IF NEW.company_cnpj IS NOT NULL THEN
      NEW.company_cnpj := public.sanitize_document(NEW.company_cnpj);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sanitize_profiles_document_trigger ON public.profiles;
DROP TRIGGER IF EXISTS sanitize_transport_companies_document_trigger ON public.transport_companies;

-- Create triggers on profiles table
CREATE TRIGGER sanitize_profiles_document_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_document_trigger();

-- Create trigger on transport_companies table
CREATE TRIGGER sanitize_transport_companies_document_trigger
  BEFORE INSERT OR UPDATE ON public.transport_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_document_trigger();

-- Add comments for documentation
COMMENT ON FUNCTION public.sanitize_document(TEXT) IS 'Remove all non-digit characters from document strings (CPF/CNPJ)';
COMMENT ON FUNCTION public.sanitize_document_trigger() IS 'Automatically sanitize document fields before insert/update';
COMMENT ON TRIGGER sanitize_profiles_document_trigger ON public.profiles IS 'Ensures document and cpf_cnpj fields contain only digits';
COMMENT ON TRIGGER sanitize_transport_companies_document_trigger ON public.transport_companies IS 'Ensures company_cnpj field contains only digits';