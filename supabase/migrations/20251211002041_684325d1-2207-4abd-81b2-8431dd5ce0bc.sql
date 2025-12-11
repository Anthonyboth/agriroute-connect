
-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Views e Funções
-- =====================================================

-- 1. Recriar view city_hierarchy com security_invoker = true
DROP VIEW IF EXISTS public.city_hierarchy;

CREATE VIEW public.city_hierarchy
WITH (security_invoker = true)
AS
SELECT 
  c.id AS city_id,
  c.name AS city_name,
  c.state AS city_state,
  c.lat,
  c.lng,
  0::bigint AS total_producers,
  0::bigint AS total_drivers,
  0::bigint AS total_providers,
  0::bigint AS total_users,
  count(DISTINCT f.id) FILTER (WHERE f.origin_city = c.name AND f.status = ANY (ARRAY['OPEN'::freight_status, 'ACCEPTED'::freight_status, 'LOADING'::freight_status, 'LOADED'::freight_status, 'IN_TRANSIT'::freight_status])) AS active_freights_origin,
  count(DISTINCT f2.id) FILTER (WHERE f2.destination_city = c.name AND f2.status = ANY (ARRAY['OPEN'::freight_status, 'ACCEPTED'::freight_status, 'LOADING'::freight_status, 'LOADED'::freight_status, 'IN_TRANSIT'::freight_status])) AS active_freights_destination,
  0::bigint AS active_services
FROM cities c
LEFT JOIN freights f ON f.origin_city = c.name
LEFT JOIN freights f2 ON f2.destination_city = c.name
GROUP BY c.id, c.name, c.state, c.lat, c.lng;

-- 2. Recriar view company_invite_links com security_invoker = true
DROP VIEW IF EXISTS public.company_invite_links;

CREATE VIEW public.company_invite_links
WITH (security_invoker = true)
AS
SELECT 
  ci.id,
  ci.company_id,
  ci.invite_code,
  ci.invite_type,
  ci.invited_email,
  tc.company_name,
  concat('https://f2dbc201-5319-4f90-a3cc-8dd215bbebba.lovableproject.com/company-invite/', ci.invite_code) AS invite_link
FROM company_invites ci
JOIN transport_companies tc ON ci.company_id = tc.id
WHERE ci.status = 'PENDING'::text AND ci.expires_at > now();

-- 3. Corrigir função validate_profile_input com search_path
CREATE OR REPLACE FUNCTION public.validate_profile_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Comentário sobre pg_net: Esta extensão não pode ser movida do schema public
-- devido a limitações técnicas. Mitigações já estão documentadas em SECURITY_DOCUMENTATION.md

-- Comentário sobre Leaked Password Protection:
-- Esta configuração deve ser habilitada manualmente no Supabase Dashboard:
-- Authentication > Settings > Enable "Leaked password protection"
