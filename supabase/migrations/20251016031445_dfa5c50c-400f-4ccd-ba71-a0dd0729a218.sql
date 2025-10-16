-- Sprint 1: Correções Críticas de Segurança
-- Adicionar SET search_path = 'public' em funções que faltam

-- 1. Função generate_invite_code (faltava search_path)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
END;
$function$;

-- 2. Função validate_primary_vehicle_assignment (faltava search_path)
CREATE OR REPLACE FUNCTION public.validate_primary_vehicle_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.is_primary = true AND NEW.removed_at IS NULL THEN
    UPDATE company_vehicle_assignments
    SET is_primary = false,
        updated_at = NOW()
    WHERE driver_profile_id = NEW.driver_profile_id
      AND company_id = NEW.company_id
      AND id != NEW.id
      AND removed_at IS NULL
      AND is_primary = true;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Função add_freight_chat_participants (faltava search_path)
CREATE OR REPLACE FUNCTION public.add_freight_chat_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
  VALUES (NEW.id, NEW.producer_id, 'PRODUCER')
  ON CONFLICT (freight_id, participant_id) DO NOTHING;
  
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    SELECT NEW.id, tc.profile_id, 'COMPANY'
    FROM transport_companies tc
    WHERE tc.id = NEW.company_id
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    VALUES (NEW.id, NEW.driver_id, 'DRIVER')
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Função add_assigned_driver_to_chat (faltava search_path)
CREATE OR REPLACE FUNCTION public.add_assigned_driver_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
  VALUES (NEW.freight_id, NEW.driver_id, 'DRIVER')
  ON CONFLICT (freight_id, participant_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- 5. Função is_transport_company (faltava search_path)
CREATE OR REPLACE FUNCTION public.is_transport_company(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM transport_companies tc
    JOIN profiles p ON tc.profile_id = p.id
    WHERE p.user_id = p_user_id
  );
END;
$function$;

-- 6. Função is_company_driver (faltava search_path)
CREATE OR REPLACE FUNCTION public.is_company_driver(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM company_drivers cd
    JOIN profiles p ON cd.driver_profile_id = p.id
    WHERE p.user_id = p_user_id
    AND cd.company_id = p_company_id
    AND cd.status = 'ACTIVE'
  );
END;
$function$;

-- 7. Função audit_company_invites (faltava search_path)
CREATE OR REPLACE FUNCTION public.audit_company_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, table_name, operation, new_data)
    VALUES (auth.uid(), 'company_invites', 'INVITE_CREATED', row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO audit_logs (user_id, table_name, operation, old_data, new_data)
    VALUES (auth.uid(), 'company_invites', 'INVITE_STATUS_CHANGED', 
            row_to_json(OLD), row_to_json(NEW));
  END IF;
  RETURN NEW;
END;
$function$;

-- 8. Função validate_vehicle_driver_assignment (faltava search_path)
CREATE OR REPLACE FUNCTION public.validate_vehicle_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.is_company_vehicle = TRUE AND NEW.assigned_driver_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM company_drivers cd
      WHERE cd.company_id = NEW.company_id
      AND cd.driver_profile_id = NEW.assigned_driver_id
      AND cd.status = 'ACTIVE'
    ) THEN
      RAISE EXCEPTION 'Motorista não está afiliado a esta transportadora';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 9. Função add_company_to_freight_chat (faltava search_path)
CREATE OR REPLACE FUNCTION public.add_company_to_freight_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO freight_chat_participants (freight_id, participant_id, participant_type)
    SELECT NEW.id, tc.profile_id, 'COMPANY'
    FROM transport_companies tc
    WHERE tc.id = NEW.company_id
    ON CONFLICT (freight_id, participant_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Script de validação: verificar se todos os usuários têm roles em user_roles
DO $$
DECLARE
  missing_count INTEGER;
  fixed_count INTEGER := 0;
BEGIN
  -- Contar perfis sem roles
  SELECT COUNT(DISTINCT p.user_id) INTO missing_count
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE ur.user_id IS NULL;
  
  IF missing_count > 0 THEN
    RAISE NOTICE 'Encontrados % usuários sem roles. Corrigindo...', missing_count;
    
    -- Criar roles baseados no campo profiles.role
    INSERT INTO user_roles (user_id, role)
    SELECT DISTINCT 
      p.user_id,
      CASE p.role
        WHEN 'ADMIN' THEN 'admin'::app_role
        WHEN 'MOTORISTA' THEN 'driver'::app_role
        WHEN 'MOTORISTA_AFILIADO' THEN 'driver'::app_role
        WHEN 'PRODUTOR' THEN 'producer'::app_role
        WHEN 'PRESTADOR_SERVICOS' THEN 'service_provider'::app_role
        WHEN 'TRANSPORTADORA' THEN 'transport_company'::app_role
        ELSE 'user'::app_role
      END
    FROM profiles p
    LEFT JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE ur.user_id IS NULL
    ON CONFLICT (user_id, role) DO NOTHING;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE 'Corrigidos % registros em user_roles', fixed_count;
  ELSE
    RAISE NOTICE 'Todos os usuários já possuem roles em user_roles ✓';
  END IF;
END $$;