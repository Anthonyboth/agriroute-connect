-- Etapa 1: Criar função de sincronização automática de service_types
CREATE OR REPLACE FUNCTION sync_service_types_to_user_cities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar todas as cidades ativas do prestador quando service_types mudar
  UPDATE user_cities uc
  SET 
    service_types = NEW.service_types,
    updated_at = now()
  WHERE uc.user_id = NEW.user_id
    AND uc.type = 'PRESTADOR_SERVICO'
    AND uc.is_active = true;
  
  RAISE LOG 'Synced service_types to user_cities for user_id: %', NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Etapa 2: Criar trigger que dispara quando profiles.service_types mudar
DROP TRIGGER IF EXISTS trigger_sync_service_types ON profiles;

CREATE TRIGGER trigger_sync_service_types
AFTER UPDATE OF service_types ON profiles
FOR EACH ROW
WHEN (OLD.service_types IS DISTINCT FROM NEW.service_types)
EXECUTE FUNCTION sync_service_types_to_user_cities();

-- Etapa 3: Backfill - Sincronizar dados existentes (one-time execution)
UPDATE user_cities uc
SET service_types = p.service_types
FROM profiles p
WHERE uc.user_id = p.user_id
  AND uc.type = 'PRESTADOR_SERVICO'
  AND p.role = 'PRESTADOR_SERVICOS'
  AND (
    uc.service_types IS NULL 
    OR uc.service_types = '{}'
    OR uc.service_types != p.service_types
  );

COMMENT ON FUNCTION sync_service_types_to_user_cities() IS 
'Sincroniza automaticamente service_types de profiles para user_cities quando há mudanças. Garante que todas as cidades ativas do prestador sempre tenham os mesmos service_types configurados globalmente.';