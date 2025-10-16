-- Criar função RPC para buscar email por documento (CPF ou CNPJ)
-- Busca primeiro em profiles.document, depois em transport_companies.company_cnpj
CREATE OR REPLACE FUNCTION public.get_email_by_document(p_doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_doc text;
  found_email text;
BEGIN
  -- Aplicar rate limit para evitar brute force
  IF NOT check_rate_limit('get_email_by_document', 50, '15 minutes'::interval) THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde alguns minutos.';
  END IF;
  
  -- Normalizar documento (remover tudo que não é dígito)
  normalized_doc := regexp_replace(p_doc, '[^0-9]', '', 'g');
  
  -- Validar tamanho (CPF = 11 dígitos, CNPJ = 14 dígitos)
  IF length(normalized_doc) NOT IN (11, 14) THEN
    RETURN NULL;
  END IF;
  
  -- Buscar primeiro em profiles.document
  SELECT p.email INTO found_email
  FROM profiles p
  WHERE p.document = normalized_doc
  LIMIT 1;
  
  -- Se não encontrou, buscar em transport_companies.company_cnpj
  IF found_email IS NULL THEN
    SELECT p.email INTO found_email
    FROM transport_companies tc
    JOIN profiles p ON p.id = tc.profile_id
    WHERE regexp_replace(tc.company_cnpj, '[^0-9]', '', 'g') = normalized_doc
    LIMIT 1;
  END IF;
  
  RETURN found_email;
END;
$$;