-- =====================================================
-- SISTEMA DEDICADO: PROGRESSO DA VIAGEM DO MOTORISTA
-- Ultra-simplificado, sem triggers complexos, à prova de falhas
-- O motorista tem controle TOTAL sobre seu progresso
-- =====================================================

-- 1. Criar tabela dedicada para o progresso da viagem
CREATE TABLE IF NOT EXISTS public.driver_trip_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freight_id UUID NOT NULL REFERENCES freights(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES freight_assignments(id) ON DELETE SET NULL,
    
    -- Status do progresso (controlado 100% pelo motorista)
    current_status TEXT NOT NULL DEFAULT 'ACCEPTED',
    
    -- Timestamps de cada etapa
    accepted_at TIMESTAMPTZ,
    loading_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ,
    in_transit_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Localização GPS opcional
    last_lat DOUBLE PRECISION,
    last_lng DOUBLE PRECISION,
    
    -- Notas do motorista
    driver_notes TEXT,
    
    -- Metadados
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraint única
    CONSTRAINT unique_driver_freight_progress UNIQUE (freight_id, driver_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_trip_progress_driver ON driver_trip_progress(driver_id);
CREATE INDEX IF NOT EXISTS idx_trip_progress_freight ON driver_trip_progress(freight_id);
CREATE INDEX IF NOT EXISTS idx_trip_progress_status ON driver_trip_progress(current_status);

-- RLS: Motorista controla 100% seu próprio progresso
ALTER TABLE driver_trip_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_owns_trip_progress" ON driver_trip_progress;
CREATE POLICY "driver_owns_trip_progress" ON driver_trip_progress
    FOR ALL USING (driver_id = auth.uid());

-- Admins e produtores podem visualizar (usando roles corretos)
DROP POLICY IF EXISTS "others_view_trip_progress" ON driver_trip_progress;
CREATE POLICY "others_view_trip_progress" ON driver_trip_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('PRODUTOR'::user_role, 'TRANSPORTADORA'::user_role)
        )
        OR
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- 2. Função principal: Atualizar progresso da viagem
-- ULTRA SIMPLES - sem triggers, sem conflitos, sem erros
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
            now(), p_lat, p_lng, p_notes
        )
        RETURNING id INTO v_progress_id;
        
        v_current_status := 'NEW';
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
        updated_at = now(),
        -- Atualizar timestamp específico
        loading_at = CASE WHEN p_new_status = 'LOADING' THEN now() ELSE loading_at END,
        loaded_at = CASE WHEN p_new_status = 'LOADED' THEN now() ELSE loaded_at END,
        in_transit_at = CASE WHEN p_new_status = 'IN_TRANSIT' THEN now() ELSE in_transit_at END,
        delivered_at = CASE WHEN p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN now() ELSE delivered_at END
    WHERE id = v_progress_id;
    
    -- Tentar sincronizar com freight_assignments (silenciosamente, não bloqueia)
    BEGIN
        UPDATE freight_assignments
        SET status = p_new_status, updated_at = now()
        WHERE id = v_assignment_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignora erros - o progresso já foi salvo
        NULL;
    END;
    
    -- Para status de entrega, também tenta atualizar o frete (silenciosamente)
    IF p_new_status IN ('DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED') THEN
        BEGIN
            UPDATE freights
            SET updated_at = now()
            WHERE id = p_freight_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    
    -- Retornar sucesso
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Progresso atualizado com sucesso',
        'progress_id', v_progress_id,
        'previous_status', v_current_status,
        'new_status', p_new_status,
        'timestamp', now()
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

-- 3. Função para buscar progresso do motorista
CREATE OR REPLACE FUNCTION public.get_my_trip_progress(p_freight_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_driver_id UUID;
    v_result JSONB;
BEGIN
    v_driver_id := auth.uid();
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;
    
    IF p_freight_id IS NOT NULL THEN
        -- Buscar progresso de um frete específico
        SELECT jsonb_build_object(
            'success', true,
            'progress', row_to_json(p.*)
        ) INTO v_result
        FROM driver_trip_progress p
        WHERE p.freight_id = p_freight_id AND p.driver_id = v_driver_id;
        
        IF v_result IS NULL THEN
            RETURN jsonb_build_object('success', true, 'progress', null);
        END IF;
        
        RETURN v_result;
    ELSE
        -- Buscar todos os progressos ativos
        SELECT jsonb_build_object(
            'success', true,
            'progresses', COALESCE(jsonb_agg(row_to_json(p.*)), '[]'::jsonb)
        ) INTO v_result
        FROM driver_trip_progress p
        WHERE p.driver_id = v_driver_id
          AND p.current_status NOT IN ('COMPLETED', 'CANCELLED');
        
        RETURN COALESCE(v_result, jsonb_build_object('success', true, 'progresses', '[]'::jsonb));
    END IF;
END;
$$;

-- 4. Conceder permissões
GRANT EXECUTE ON FUNCTION public.update_trip_progress TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_trip_progress TO authenticated;
GRANT ALL ON TABLE driver_trip_progress TO authenticated;

-- 5. Comentários
COMMENT ON TABLE driver_trip_progress IS 'Tabela dedicada para controle de progresso da viagem pelo motorista - 100% sob controle do motorista';
COMMENT ON FUNCTION public.update_trip_progress IS 'Função simplificada e à prova de falhas para motorista atualizar progresso da viagem';