
-- =====================================================
-- FIX: Resolver timeout de carregamento e alerta do linter
-- 
-- Problema: security_invoker=false + WHERE clause com 
-- is_freight_participant() e is_affiliated_driver_of_my_company()
-- para CADA linha é extremamente lento, causando BOOTSTRAP_TIMEOUT.
--
-- Solução: Voltar para security_invoker=true (resolve linter)
-- e restaurar policies na tabela base (necessárias para a view funcionar).
-- O mascaramento corrigido (p.user_id = auth.uid()) é mantido.
-- =====================================================

-- 1. Recriar view com security_invoker=true e mascaramento corrigido
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure
WITH (security_invoker=true) AS
SELECT 
    p.id,
    p.user_id,
    p.full_name,
    p.status,
    p.rating,
    p.total_ratings,
    p.created_at,
    p.updated_at,
    CASE
        WHEN p.user_id = auth.uid() THEN COALESCE(decrypt_pii_field(e.cpf_cnpj_encrypted), p.cpf_cnpj)
        ELSE concat(left(p.cpf_cnpj, 3), '.***.***-**')
    END AS cpf_cnpj,
    CASE
        WHEN p.user_id = auth.uid() THEN COALESCE(decrypt_pii_field(e.phone_encrypted), p.phone)
        WHEN p.phone IS NOT NULL THEN concat('(**)*****-', right(p.phone, 4))
        ELSE NULL::text
    END AS phone,
    CASE
        WHEN p.user_id = auth.uid() THEN COALESCE(decrypt_pii_field(e.contact_phone_encrypted), p.contact_phone)
        WHEN p.contact_phone IS NOT NULL THEN concat('(**)*****-', right(p.contact_phone, 4))
        ELSE NULL::text
    END AS contact_phone,
    CASE
        WHEN p.user_id = auth.uid() THEN COALESCE(decrypt_pii_field(e.address_street_encrypted), p.address_street)
        ELSE '***'::text
    END AS address_street,
    CASE
        WHEN p.user_id = auth.uid() THEN COALESCE(decrypt_pii_field(e.address_city_encrypted), p.address_city)
        ELSE p.address_city
    END AS address_city,
    CASE
        WHEN p.user_id = auth.uid() THEN COALESCE(decrypt_pii_field(e.address_state_encrypted), p.address_state)
        ELSE p.address_state
    END AS address_state,
    p.profile_photo_url,
    p.service_types,
    p.base_city_name,
    p.base_state,
    p.aprovado,
    p.validation_status
FROM profiles p
LEFT JOIN profiles_encrypted_data e ON e.id = p.id;

-- 2. Restaurar policies de visibilidade cross-user na tabela base
-- (necessárias para security_invoker=true funcionar na view)
CREATE POLICY "profiles_select_freight_participants"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_freight_participant(id));

CREATE POLICY "profiles_select_affiliated_drivers"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_affiliated_driver_of_my_company(id));
