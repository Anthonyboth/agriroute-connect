
-- RPC para retornar dados do responsável da transportadora para motoristas afiliados ativos
CREATE OR REPLACE FUNCTION public.get_company_owner_for_affiliated_driver(p_company_id UUID)
RETURNS TABLE(
  owner_profile_id UUID,
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_profile_id UUID;
  v_is_affiliated BOOLEAN;
BEGIN
  -- Obter o profile_id do usuário autenticado
  SELECT id INTO v_caller_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF v_caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verificar se o caller é motorista ativo dessa transportadora
  SELECT EXISTS (
    SELECT 1 FROM public.company_drivers cd
    WHERE cd.company_id = p_company_id
      AND cd.driver_profile_id = v_caller_profile_id
      AND cd.status = 'ACTIVE'
  ) INTO v_is_affiliated;

  IF NOT v_is_affiliated AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: você não é motorista afiliado ativo desta transportadora';
  END IF;

  -- Retornar dados do responsável (owner) da transportadora
  RETURN QUERY
  SELECT
    p.id AS owner_profile_id,
    p.full_name AS owner_name,
    p.email AS owner_email,
    COALESCE(p.contact_phone, p.phone) AS owner_phone
  FROM public.transport_companies tc
  JOIN public.profiles p ON p.id = tc.profile_id
  WHERE tc.id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_owner_for_affiliated_driver(UUID) TO authenticated;
