-- =============================================
-- FIX: driver_update_freight_status - Verificar TODOS os status ativos do assignment
-- O bug: A função verificava apenas status = 'ACCEPTED' no freight_assignments
-- Mas quando o motorista já está em LOADING, o assignment também está em LOADING
-- Então a verificação de permissão falhava incorretamente
-- =============================================

-- Drop all existing versions
DO $$ 
DECLARE
  func_signature text;
BEGIN
  FOR func_signature IN 
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    WHERE p.proname = 'driver_update_freight_status'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_signature || ' CASCADE';
    RAISE NOTICE 'Dropped: %', func_signature;
  END LOOP;
END $$;

-- Create fixed function with correct permission check
CREATE OR REPLACE FUNCTION driver_update_freight_status(
  p_freight_id uuid,
  p_new_status text,
  p_user_id uuid,
  p_notes text DEFAULT NULL,
  p_location jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '5s'
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_driver_id uuid;
  v_has_permission boolean := false;
  v_profile_id uuid;
BEGIN
  -- ✅ Buscar profile_id do usuário (auth.uid() != profile.id)
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_profile_id IS NULL THEN
    -- Fallback: talvez p_user_id já seja o profile_id
    v_profile_id := p_user_id;
  END IF;

  -- Buscar dados do frete
  SELECT status, driver_id 
  INTO v_old_status, v_driver_id
  FROM freights
  WHERE id = p_freight_id;
  
  IF v_old_status IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Frete não encontrado',
      'code', 'FREIGHT_NOT_FOUND'
    );
  END IF;
  
  -- ✅ Verificação de permissão: motorista direto no frete
  IF v_driver_id = v_profile_id THEN
    v_has_permission := true;
  ELSE
    -- ✅ FIX: Verificar freight_assignments com QUALQUER status ativo
    -- Não apenas 'ACCEPTED', mas também 'LOADING', 'LOADED', 'IN_TRANSIT'
    SELECT EXISTS (
      SELECT 1 FROM freight_assignments
      WHERE freight_id = p_freight_id
      AND driver_id = v_profile_id
      AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT')
      LIMIT 1
    ) INTO v_has_permission;
  END IF;
  
  IF NOT v_has_permission THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Você não tem permissão para atualizar este frete',
      'code', 'PERMISSION_DENIED',
      'debug_freight_driver_id', v_driver_id,
      'debug_user_profile_id', v_profile_id
    );
  END IF;
  
  -- Atualizar o frete
  UPDATE freights 
  SET 
    status = p_new_status::text,
    updated_at = now()
  WHERE id = p_freight_id;
  
  -- ✅ Também atualizar o status do assignment (sincronização)
  UPDATE freight_assignments
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE freight_id = p_freight_id
  AND driver_id = v_profile_id
  AND status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');
  
  -- Inserir histórico (não bloqueante)
  BEGIN
    INSERT INTO freight_status_history (
      freight_id,
      old_status,
      new_status,
      changed_by,
      notes,
      location,
      created_at
    ) VALUES (
      p_freight_id,
      v_old_status,
      p_new_status,
      v_profile_id,
      p_notes,
      p_location,
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Erro ao inserir histórico (não bloqueante): %', SQLERRM;
  END;
  
  RETURN json_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'updated_at', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', 'UNKNOWN_ERROR'
    );
END;
$$;

COMMENT ON FUNCTION driver_update_freight_status IS 
'Atualiza status de frete. Permite motoristas diretos E com assignments em qualquer status ativo (ACCEPTED, LOADING, LOADED, IN_TRANSIT).';

-- Verificar e criar índice para otimizar a query de permissão
CREATE INDEX IF NOT EXISTS idx_freight_assignments_active_status
ON freight_assignments(freight_id, driver_id, status) 
WHERE status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');