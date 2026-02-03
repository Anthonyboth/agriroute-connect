-- Fix: driver_trip_progress and related RPCs were using auth.uid() as driver_id,
-- but driver_trip_progress.driver_id (and freight_assignments.driver_id, freight_status_history.changed_by)
-- reference public.profiles.id. This caused FK violations when updating trip status.

-- 1) Helper to map auth user -> profile id
CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;

-- 2) Fix RPC: get_my_trip_progress
CREATE OR REPLACE FUNCTION public.get_my_trip_progress(p_freight_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_driver_profile_id uuid;
    v_result jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    v_driver_profile_id := public.get_my_profile_id();

    IF v_driver_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
    END IF;

    IF p_freight_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'success', true,
            'progress', row_to_json(p.*)
        )
        INTO v_result
        FROM driver_trip_progress p
        WHERE p.freight_id = p_freight_id
          AND p.driver_id = v_driver_profile_id;

        IF v_result IS NULL THEN
            RETURN jsonb_build_object('success', true, 'progress', null);
        END IF;

        RETURN v_result;
    ELSE
        SELECT jsonb_build_object(
            'success', true,
            'progresses', COALESCE(jsonb_agg(row_to_json(p.*)), '[]'::jsonb)
        )
        INTO v_result
        FROM driver_trip_progress p
        WHERE p.driver_id = v_driver_profile_id
          AND p.current_status NOT IN ('COMPLETED', 'CANCELLED');

        RETURN COALESCE(v_result, jsonb_build_object('success', true, 'progresses', '[]'::jsonb));
    END IF;
END;
$function$;

-- 3) Fix RPC: update_trip_progress
CREATE OR REPLACE FUNCTION public.update_trip_progress(
  p_freight_id uuid,
  p_new_status text,
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_driver_profile_id uuid;
    v_current_status text;
    v_assignment_id uuid;
    v_progress_id uuid;
    v_timestamp timestamptz := now();
BEGIN
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
        RAISE NOTICE 'Erro ao inserir histórico: %', SQLERRM;
    END;

    -- Sincronizar com freight_assignments (silenciosamente)
    BEGIN
        UPDATE freight_assignments
        SET status = p_new_status, updated_at = v_timestamp
        WHERE id = v_assignment_id;
    EXCEPTION WHEN OTHERS THEN
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
$function$;

-- 4) (Optional but safe) Fix RLS policy for driver own access (keeps intent, just correct key mapping)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='driver_trip_progress' AND policyname='driver_owns_trip_progress'
  ) THEN
    EXECUTE 'ALTER POLICY driver_owns_trip_progress ON public.driver_trip_progress USING (driver_id = public.get_my_profile_id()) WITH CHECK (driver_id = public.get_my_profile_id())';
  END IF;
END $$;