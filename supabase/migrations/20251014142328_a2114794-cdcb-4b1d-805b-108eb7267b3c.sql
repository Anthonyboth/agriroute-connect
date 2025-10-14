-- Função RPC segura para buscar transportadora por CNPJ (normaliza pontuação)
CREATE OR REPLACE FUNCTION public.find_company_by_cnpj(p_cnpj text)
RETURNS TABLE(id uuid, company_name text, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.company_name, tc.status
  FROM transport_companies tc
  WHERE regexp_replace(tc.company_cnpj, '[^0-9]', '', 'g') = regexp_replace(p_cnpj, '[^0-9]', '', 'g')
  LIMIT 1;
END;
$$;