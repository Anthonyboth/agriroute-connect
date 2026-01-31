-- Adicionar política para transportadoras verem perfis de motoristas afiliados
CREATE POLICY "profiles_select_affiliated_drivers" ON public.profiles
  FOR SELECT
  USING (
    -- O perfil pertence a um motorista afiliado ativo da transportadora do usuário
    id IN (
      SELECT cd.driver_profile_id 
      FROM company_drivers cd
      INNER JOIN transport_companies tc ON cd.company_id = tc.id
      WHERE tc.profile_id = auth.uid()
        AND cd.status IN ('ACTIVE', 'INACTIVE', 'PENDING')
    )
  );

-- Criar função RPC para buscar dados completos de motorista afiliado (fallback)
CREATE OR REPLACE FUNCTION public.get_affiliated_driver_profile(
  p_driver_profile_id UUID,
  p_company_id UUID
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  contact_phone TEXT,
  cpf_cnpj TEXT,
  rating NUMERIC,
  total_ratings INTEGER,
  profile_photo_url TEXT,
  selfie_url TEXT,
  cnh_photo_url TEXT,
  cnh_category TEXT,
  cnh_expiry_date DATE,
  rntrc TEXT,
  document_validation_status TEXT,
  cnh_validation_status TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  created_at TIMESTAMPTZ,
  role TEXT,
  status TEXT,
  can_accept_freights BOOLEAN,
  can_manage_vehicles BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é dono da transportadora
  IF NOT EXISTS (
    SELECT 1 FROM transport_companies tc
    WHERE tc.id = p_company_id AND tc.profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: você não é o dono desta transportadora';
  END IF;

  -- Verificar se o motorista está afiliado
  IF NOT EXISTS (
    SELECT 1 FROM company_drivers cd
    WHERE cd.company_id = p_company_id 
      AND cd.driver_profile_id = p_driver_profile_id
      AND cd.status IN ('ACTIVE', 'INACTIVE', 'PENDING')
  ) THEN
    RAISE EXCEPTION 'Acesso negado: motorista não está afiliado à transportadora';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.contact_phone,
    p.cpf_cnpj,
    p.rating,
    p.total_ratings,
    p.profile_photo_url,
    p.selfie_url,
    p.cnh_photo_url,
    p.cnh_category,
    p.cnh_expiry_date,
    p.rntrc,
    p.document_validation_status,
    p.cnh_validation_status,
    p.address_street,
    p.address_number,
    p.address_complement,
    p.address_neighborhood,
    p.address_city,
    p.address_state,
    p.address_zip,
    p.created_at,
    p.role::TEXT,
    cd.status,
    cd.can_accept_freights,
    cd.can_manage_vehicles
  FROM profiles p
  INNER JOIN company_drivers cd ON cd.driver_profile_id = p.id
  WHERE p.id = p_driver_profile_id
    AND cd.company_id = p_company_id;
END;
$$;

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_affiliated_driver_profile(UUID, UUID) TO authenticated;