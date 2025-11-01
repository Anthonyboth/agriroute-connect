-- ============================================================
-- CORREÇÃO: Statement Timeout na Atualização de Status
-- ============================================================
-- Drop de funções antigas que causavam ambiguidade e lentidão
DROP FUNCTION IF EXISTS public.driver_update_freight_status(uuid, freight_status, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.driver_update_freight_status(uuid, text, uuid, text, jsonb);

-- ============================================================
-- FUNÇÃO CANÔNICA: driver_update_freight_status
-- ============================================================
-- Otimizada com timeouts apropriados e índices
CREATE OR REPLACE FUNCTION public.driver_update_freight_status(
  p_freight_id uuid,
  p_new_status text,
  p_user_id uuid,
  p_notes text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_assignment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET lock_timeout = '2s'
SET statement_timeout = '30s'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Atualizar status do frete
  UPDATE public.freights
  SET 
    status = p_new_status::freight_status,
    updated_at = now()
  WHERE id = p_freight_id;

  -- Se houver assignment_id, atualizar também
  IF p_assignment_id IS NOT NULL THEN
    UPDATE public.freight_assignments
    SET 
      status = p_new_status::freight_status,
      updated_at = now()
    WHERE id = p_assignment_id;
  END IF;

  -- Registrar checkin se houver coordenadas
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    INSERT INTO public.freight_checkins (
      freight_id,
      driver_profile_id,
      latitude,
      longitude,
      status,
      notes
    ) VALUES (
      p_freight_id,
      p_user_id,
      p_lat,
      p_lng,
      p_new_status::freight_status,
      p_notes
    );
  END IF;

  -- Registrar histórico de status
  INSERT INTO public.freight_status_history (
    freight_id,
    status,
    changed_by,
    notes
  ) VALUES (
    p_freight_id,
    p_new_status::freight_status,
    p_user_id,
    p_notes
  );

  -- Retornar sucesso
  v_result := jsonb_build_object(
    'success', true,
    'freight_id', p_freight_id,
    'new_status', p_new_status
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- ============================================================
-- Otimizar consultas de histórico de status
CREATE INDEX IF NOT EXISTS idx_freight_status_history_freight_created 
ON public.freight_status_history (freight_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_freight_status_history_freight_status_created 
ON public.freight_status_history (freight_id, status, created_at DESC);

-- Otimizar consultas de checkins
CREATE INDEX IF NOT EXISTS idx_freight_checkins_freight_created
ON public.freight_checkins (freight_id, created_at DESC);

-- Comentários
COMMENT ON FUNCTION public.driver_update_freight_status IS 
'Atualiza status do frete de forma otimizada com timeouts apropriados. 
Parâmetros: freight_id, new_status, user_id, notes (opcional), lat/lng (opcional), assignment_id (opcional)';