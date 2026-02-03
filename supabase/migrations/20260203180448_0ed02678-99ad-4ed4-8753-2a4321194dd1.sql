-- Adicionar validação de não-regressão de status na RPC update_trip_progress
-- Isso impede que um motorista volte para um status anterior (ex: LOADED -> LOADING)

CREATE OR REPLACE FUNCTION public.update_trip_progress(
    p_freight_id uuid,
    p_new_status text,
    p_lat double precision DEFAULT NULL,
    p_lng double precision DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_driver_profile_id uuid;
    v_current_status text;
    v_assignment_id uuid;
    v_progress_id uuid;
    v_timestamp timestamptz := now();
    v_current_index int;
    v_new_index int;
    v_status_order text[] := ARRAY['NEW', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'];
BEGIN
    -- Validar autenticação
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_AUTHENTICATED',
            'message', 'Usuário não autenticado'
        );
    END IF;

    v_driver_profile_id := public.get_my_profile_id();

    IF v_driver_profile_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'PROFILE_NOT_FOUND',
            'message', 'Perfil não encontrado para o usuário autenticado'
        );
    END IF;

    -- Normalizar status para maiúsculas
    p_new_status := UPPER(TRIM(p_new_status));

    -- Validar status permitidos
    IF p_new_status NOT IN (
      'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT',
      'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_STATUS',
            'message', 'Status inválido: ' || p_new_status
        );
    END IF;

    -- Buscar assignment do motorista (para referência)
    SELECT id
      INTO v_assignment_id
    FROM freight_assignments
    WHERE freight_id = p_freight_id
      AND driver_id = v_driver_profile_id
      AND status NOT IN ('CANCELLED', 'REJECTED')
    LIMIT 1;

    -- Verificar se existe registro de progresso
    SELECT id, current_status
      INTO v_progress_id, v_current_status
    FROM driver_trip_progress
    WHERE freight_id = p_freight_id
      AND driver_id = v_driver_profile_id;

    -- Se não existe, criar novo registro
    IF v_progress_id IS NULL THEN
        INSERT INTO driver_trip_progress (
            freight_id, driver_id, assignment_id, current_status,
            accepted_at, last_lat, last_lng, driver_notes
        ) VALUES (
            p_freight_id, v_driver_profile_id, v_assignment_id, p_new_status,
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
                v_driver_profile_id,
                COALESCE(p_notes, 'Progresso iniciado: ' || p_new_status),
                p_lat,
                p_lng,
                v_timestamp
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        
        -- Para novo registro, retornar sucesso
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Progresso criado com sucesso',
            'progress_id', v_progress_id,
            'previous_status', 'NEW',
            'new_status', p_new_status,
            'timestamp', v_timestamp
        );
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

    -- =====================================================
    -- VALIDAÇÃO DE NÃO-REGRESSÃO DE STATUS
    -- Impede voltar para um status anterior na sequência
    -- =====================================================
    v_current_index := array_position(v_status_order, v_current_status);
    v_new_index := array_position(v_status_order, p_new_status);
    
    -- Se não encontrou o status atual na ordem, assume que está em NEW
    IF v_current_index IS NULL THEN
        v_current_index := 1;
    END IF;
    
    IF v_new_index IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_STATUS_TRANSITION',
            'message', 'Status de destino não reconhecido: ' || p_new_status
        );
    END IF;
    
    -- Bloquear regressão de status
    IF v_new_index < v_current_index THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'STATUS_REGRESSION_BLOCKED',
            'message', 'Não é permitido voltar de "' || v_current_status || '" para "' || p_new_status || '". O status só pode avançar.',
            'current_status', v_current_status,
            'attempted_status', p_new_status
        );
    END IF;
    
    -- Bloquear salto de mais de 1 passo (opcional, mas recomendado)
    IF v_new_index > v_current_index + 1 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'STATUS_SKIP_BLOCKED',
            'message', 'Não é permitido pular etapas. De "' || v_current_status || '" você só pode ir para o próximo status.',
            'current_status', v_current_status,
            'attempted_status', p_new_status,
            'expected_next', v_status_order[v_current_index + 1]
        );
    END IF;
    -- =====================================================

    -- Atualizar progresso
    UPDATE driver_trip_progress
    SET
        current_status = p_new_status,
        last_lat = COALESCE(p_lat, last_lat),
        last_lng = COALESCE(p_lng, last_lng),
        driver_notes = COALESCE(p_notes, driver_notes),
        updated_at = v_timestamp,
        loading_at = CASE WHEN p_new_status = 'LOADING' THEN v_timestamp ELSE loading_at END,
        loaded_at = CASE WHEN p_new_status = 'LOADED' THEN v_timestamp ELSE loaded_at END,
        in_transit_at = CASE WHEN p_new_status = 'IN_TRANSIT' THEN v_timestamp ELSE in_transit_at END,
        delivered_at = CASE WHEN p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN v_timestamp ELSE delivered_at END
    WHERE id = v_progress_id;

    -- Registrar no histórico de status
    BEGIN
        INSERT INTO freight_status_history (
            freight_id, status, changed_by, notes, location_lat, location_lng, created_at
        ) VALUES (
            p_freight_id,
            p_new_status::freight_status,
            v_driver_profile_id,
            COALESCE(p_notes, 'Status atualizado: ' || v_current_status || ' → ' || p_new_status),
            p_lat,
            p_lng,
            v_timestamp
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Sincronizar com tabelas legadas (silenciosamente)
    BEGIN
        UPDATE freight_assignments
        SET status = p_new_status, updated_at = v_timestamp
        WHERE id = v_assignment_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Para fretes simples (não multi-carreta), sincronizar freights.status também
    BEGIN
        UPDATE freights
        SET status = p_new_status::freight_status, updated_at = v_timestamp
        WHERE id = p_freight_id
          AND required_trucks <= 1;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Progresso atualizado com sucesso',
        'progress_id', v_progress_id,
        'previous_status', v_current_status,
        'new_status', p_new_status,
        'timestamp', v_timestamp
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

-- Comentário explicativo
COMMENT ON FUNCTION public.update_trip_progress IS 
'Atualiza o progresso da viagem do motorista com validação de não-regressão de status.
Impede que o status volte para uma etapa anterior (ex: LOADED -> LOADING).
Também impede pular etapas na progressão.';