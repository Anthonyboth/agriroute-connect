
-- Inserir roles para todos os perfis existentes
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'driver'::app_role
FROM profiles p
WHERE p.role = 'MOTORISTA'::user_role
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'driver')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'affiliated_driver'::app_role
FROM profiles p
WHERE p.role = 'MOTORISTA_AFILIADO'::user_role
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'affiliated_driver')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'producer'::app_role
FROM profiles p
WHERE p.role = 'PRODUTOR'::user_role
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'producer')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'carrier'::app_role
FROM profiles p
WHERE p.role = 'TRANSPORTADORA'::user_role
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'carrier')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'service_provider'::app_role
FROM profiles p
WHERE p.role = 'PRESTADOR_SERVICOS'::user_role
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'service_provider')
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger para auto-atribuir role quando perfil é criado/atualizado
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS TRIGGER AS $$
DECLARE
  v_app_role app_role;
BEGIN
  v_app_role := CASE NEW.role::text
    WHEN 'MOTORISTA' THEN 'driver'::app_role
    WHEN 'MOTORISTA_AFILIADO' THEN 'affiliated_driver'::app_role
    WHEN 'PRODUTOR' THEN 'producer'::app_role
    WHEN 'TRANSPORTADORA' THEN 'carrier'::app_role
    WHEN 'PRESTADOR_SERVICOS' THEN 'service_provider'::app_role
    ELSE NULL
  END;

  IF v_app_role IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, v_app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_role
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_to_user_roles();
