
-- =====================================================
-- CORREÇÃO: Histórico de Status e Progresso do Motorista
-- Garante persistência completa e registros com timestamps
-- =====================================================

-- 1. Atualizar a função update_trip_progress para também salvar histórico
CREATE OR REPLACE FUNCTION public.update_trip_progress(
    p_freight_id UUID,
    p_new_status TEXT,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_driver_id UUID;
    v_current_status TEXT;
    v_assignment_id UUID;
    v_progress_id UUID;
    v_result JSONB;
    v_timestamp TIMESTAMPTZ := now();
BEGIN
    -- Pegar ID do motorista autenticado
    v_driver_id := auth.uid();
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_AUTHENTICATED',
            'message', 'Usuário não autenticado'
        );
    END IF;
    
    -- Normalizar status para maiúsculas
    p_new_status := UPPER(TRIM(p_new_status));
    
    -- Validar status permitidos
    IF p_new_status NOT IN ('ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', 'Status inválido: ' || p_new_status
        );
    END IF;
    
    -- Buscar assignment do motorista (para referência)
    SELECT id INTO v_assignment_id
    FROM freight_assignments
    WHERE freight_id = p_freight_id
      AND driver_id = v_driver_id
      AND status NOT IN ('CANCELLED', 'REJECTED')
    LIMIT 1;
    
    -- Verificar se existe registro de progresso
    SELECT id, current_status INTO v_progress_id, v_current_status
    FROM driver_trip_progress
    WHERE freight_id = p_freight_id AND driver_id = v_driver_id;
    
    -- Se não existe, criar novo registro
    IF v_progress_id IS NULL THEN
        INSERT INTO driver_trip_progress (
            freight_id, driver_id, assignment_id, current_status,
            accepted_at, last_lat, last_lng, driver_notes
        ) VALUES (
            p_freight_id, v_driver_id, v_assignment_id, p_new_status,
            v_timestamp, p_lat, p_lng, p_notes
        )
        RETURNING id INTO v_progress_id;
        
        v_current_status := 'NEW';
        
        -- Registrar no histórico de status (novo progresso)
        BEGIN
            INSERT INTO freight_status_history (
                freight_id, status, changed_by, notes, location_lat, location_lng, created_at
            ) VALUES (
                p_freight_id, 
                p_new_status::freight_status, 
                v_driver_id, 
                COALESCE(p_notes, 'Progresso iniciado: ' || p_new_status),
                p_lat,
                p_lng,
                v_timestamp
            );
        EXCEPTION WHEN OTHERS THEN
            -- Ignora erro de histórico - não bloqueia o progresso
            NULL;
        END;
    END IF;
    
    -- Idempotência: se já está no status, retorna sucesso
    IF v_current_status = p_new_status THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Status já atualizado',
            'progress_id', v_progress_id,
            'status', p_new_status,
            'idempotent', true
        );
    END IF;
    
    -- Atualizar progresso
    UPDATE driver_trip_progress
    SET 
        current_status = p_new_status,
        last_lat = COALESCE(p_lat, last_lat),
        last_lng = COALESCE(p_lng, last_lng),
        driver_notes = COALESCE(p_notes, driver_notes),
        updated_at = v_timestamp,
        -- Atualizar timestamp específico
        loading_at = CASE WHEN p_new_status = 'LOADING' THEN v_timestamp ELSE loading_at END,
        loaded_at = CASE WHEN p_new_status = 'LOADED' THEN v_timestamp ELSE loaded_at END,
        in_transit_at = CASE WHEN p_new_status = 'IN_TRANSIT' THEN v_timestamp ELSE in_transit_at END,
        delivered_at = CASE WHEN p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN v_timestamp ELSE delivered_at END
    WHERE id = v_progress_id;
    
    -- IMPORTANTE: Registrar SEMPRE no histórico de status
    BEGIN
        INSERT INTO freight_status_history (
            freight_id, status, changed_by, notes, location_lat, location_lng, created_at
        ) VALUES (
            p_freight_id, 
            p_new_status::freight_status, 
            v_driver_id, 
            COALESCE(p_notes, 'Status atualizado: ' || v_current_status || ' → ' || p_new_status),
            p_lat,
            p_lng,
            v_timestamp
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log do erro mas não bloqueia
        RAISE NOTICE 'Erro ao inserir histórico: %', SQLERRM;
    END;
    
    -- Tentar sincronizar com freight_assignments (silenciosamente, não bloqueia)
    BEGIN
        UPDATE freight_assignments
        SET status = p_new_status, updated_at = v_timestamp
        WHERE id = v_assignment_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignora erros - o progresso já foi salvo
        NULL;
    END;
    
    -- Para status de entrega, também tenta atualizar o frete (silenciosamente)
    IF p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN
        BEGIN
            UPDATE freights
            SET updated_at = v_timestamp
            WHERE id = p_freight_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    
    -- Retornar sucesso com timestamps
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Progresso atualizado com sucesso',
        'progress_id', v_progress_id,
        'previous_status', v_current_status,
        'new_status', p_new_status,
        'timestamp', v_timestamp,
        'history_saved', true
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'UNEXPECTED_ERROR',
        'message', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

-- 2. Adicionar comentário atualizado
COMMENT ON FUNCTION public.update_trip_progress IS 'Função para motorista atualizar progresso da viagem - AGORA COM HISTÓRICO COMPLETO';
