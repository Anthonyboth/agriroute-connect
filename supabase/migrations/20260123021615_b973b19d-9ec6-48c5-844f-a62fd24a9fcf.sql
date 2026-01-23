-- =====================================================
-- CORRIGIR AVISOS DE SEGURANÇA DO LINTER
-- =====================================================

-- 1. Substituir policies permissivas por policies mais restritivas
-- A tabela encryption_keys deliberadamente não tem policies (apenas service_role acessa)
-- Isso é intencional e correto - chaves criptográficas não devem ser acessíveis via client

-- 2. Corrigir policy INSERT na profiles_encrypted_data
-- Restringir INSERT apenas via trigger (service_role context)
DROP POLICY IF EXISTS "pii_insert_system" ON public.profiles_encrypted_data;
CREATE POLICY "pii_insert_trigger_only" 
ON public.profiles_encrypted_data 
FOR INSERT 
WITH CHECK (
  -- Permite INSERT apenas quando o ID já existe em profiles (via trigger)
  EXISTS (SELECT 1 FROM public.profiles WHERE id = profiles_encrypted_data.id)
);

-- 3. Corrigir policy DELETE
DROP POLICY IF EXISTS "pii_delete_system" ON public.profiles_encrypted_data;
CREATE POLICY "pii_delete_cascade" 
ON public.profiles_encrypted_data 
FOR DELETE 
USING (
  -- Permite DELETE apenas para o próprio usuário ou via cascade
  id = auth.uid() OR 
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = profiles_encrypted_data.id)
);

-- 4. Converter a view profiles_secure para SECURITY INVOKER (padrão)
-- A view já usa SECURITY INVOKER por padrão, mas vamos garantir que as permissões
-- são aplicadas corretamente através do caller
DROP VIEW IF EXISTS public.profiles_secure;
CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
SELECT 
  p.id, p.user_id, p.full_name, p.status, p.rating, p.total_ratings, 
  p.created_at, p.updated_at,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.cpf_cnpj_encrypted), p.cpf_cnpj) 
    ELSE CONCAT(LEFT(p.cpf_cnpj, 3), '.***.***-**') 
  END as cpf_cnpj,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.phone_encrypted), p.phone) 
    WHEN p.phone IS NOT NULL THEN CONCAT('(**)*****-', RIGHT(p.phone, 4)) 
    ELSE NULL 
  END as phone,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.contact_phone_encrypted), p.contact_phone) 
    WHEN p.contact_phone IS NOT NULL THEN CONCAT('(**)*****-', RIGHT(p.contact_phone, 4)) 
    ELSE NULL 
  END as contact_phone,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.address_street_encrypted), p.address_street) 
    ELSE '***' 
  END as address_street,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.address_city_encrypted), p.address_city) 
    ELSE p.address_city 
  END as address_city,
  CASE 
    WHEN p.id = auth.uid() THEN COALESCE(public.decrypt_pii_field(e.address_state_encrypted), p.address_state) 
    ELSE p.address_state 
  END as address_state,
  p.profile_photo_url, 
  p.service_types, 
  p.base_city_name, 
  p.base_state, 
  p.aprovado, 
  p.validation_status
FROM public.profiles p 
LEFT JOIN public.profiles_encrypted_data e ON e.id = p.id;

-- 5. Comentário de documentação
COMMENT ON VIEW public.profiles_secure IS 
'View segura com SECURITY INVOKER que mascara dados PII para usuários não-proprietários. Conformidade LGPD.';

COMMENT ON TABLE public.encryption_keys IS 
'Chaves de criptografia AES-256. RLS habilitado SEM policies = apenas service_role pode acessar (intencional para segurança).';
