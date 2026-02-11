
-- =====================================================
-- FIX 1: Corrigir bug de mascaramento na view profiles_secure
-- O bug: p.id = auth.uid() NUNCA funciona porque p.id é profile UUID
-- e auth.uid() é auth user UUID. Deve ser p.user_id = auth.uid()
-- =====================================================

-- Recriar a view com security_invoker=false para que ela possa acessar
-- os dados da tabela base independentemente das policies RLS,
-- E com o mascaramento corrigido usando p.user_id = auth.uid()
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure
WITH (security_invoker=false) AS
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
LEFT JOIN profiles_encrypted_data e ON e.id = p.id
WHERE
    -- Controle de acesso embutido na view:
    -- Dono do perfil
    p.user_id = auth.uid()
    -- Admin
    OR public.has_role(auth.uid(), 'admin')
    -- Participante de frete ativo
    OR public.is_freight_participant(p.id)
    -- Motorista afiliado da transportadora do caller
    OR public.is_affiliated_driver_of_my_company(p.id);

-- =====================================================
-- FIX 2: Remover policies que expõem PII raw da tabela base profiles
-- A visibilidade cross-user agora é feita EXCLUSIVAMENTE pela view
-- profiles_secure (que mascara dados sensíveis)
-- =====================================================

DROP POLICY IF EXISTS "profiles_select_freight_participants" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_affiliated_drivers" ON public.profiles;

-- Agora a tabela base 'profiles' só tem SELECT policies para:
-- profiles_select_own_only: user_id = auth.uid() (dono do perfil)
-- profiles_select_admin: has_role(auth.uid(), 'admin') (admin)
-- profiles_deny_anon_select: false (bloqueia anon)
