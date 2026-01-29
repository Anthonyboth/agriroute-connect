-- =============================================
-- FIX: Otimizar driver_update_freight_status para evitar timeout
-- O problema: Muitos triggers encadeados causam statement timeout
-- Solução: Aumentar timeout e simplificar lógica
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

-- Create optimized function with longer timeout
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
SET statement_timeout TO '15s'  -- Aumentado de 5s para 15s
SET lock_timeout TO '3s'
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
  
  -- ✅ Validação de transição antes de atualizar (evita trigger erro)
  IF v_old_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED')
     AND p_new_status NOT IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Não é possível alterar status de frete já finalizado',
      'code', 'FREIGHT_ALREADY_CONFIRMED'
    );
  END IF;
  
  -- Atualizar o frete
  UPDATE freights 
  SET 
    status = p_new_status::freight_status,
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
'Atualiza status de frete (timeout 15s). Permite motoristas diretos E com assignments em qualquer status ativo.';

-- Garantir índice para otimizar a query de permissão
CREATE INDEX IF NOT EXISTS idx_freight_assignments_active_status
ON freight_assignments(freight_id, driver_id, status) 
WHERE status IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT');