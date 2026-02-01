-- =============================
-- Security fix: tighten access to profiles (PII)
-- =============================

-- Remove broad visibility of affiliated drivers from raw profiles table
DROP POLICY IF EXISTS "profiles_select_affiliated_drivers" ON public.profiles;

-- Ensure only the user themselves (or admin) can read from profiles
-- (keeping existing own/admin policies if present)
DROP POLICY IF EXISTS "profiles_select_own_only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

CREATE POLICY "profiles_select_own_only"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "profiles_select_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep existing INSERT/UPDATE/DELETE policies as-is (they were already scoped)


-- =============================
-- Business fix: rural multi-truck expiration (retroactive)
-- =============================
-- Fix auto_cancel_overdue_freights so it never cancels partially-accepted rural freights.
-- Instead, when a rural (CARGA) freight is partially accepted and the pickup window expires,
-- we close the remaining slots by setting required_trucks = accepted_trucks.

DROP FUNCTION IF EXISTS public.auto_cancel_overdue_freights();

CREATE OR REPLACE FUNCTION public.auto_cancel_overdue_freights()
RETURNS TABLE (
  item_id UUID,
  item_type TEXT,
  service_type TEXT,
  origin_city TEXT,
  destination_city TEXT,
  created_date TIMESTAMPTZ,
  expiration_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partial_rural RECORD;
  v_cancelled_freight RECORD;
  v_cancelled_service RECORD;
  v_cancelled_count INTEGER := 0;
  v_reason TEXT;
BEGIN
  -- =============================================
  -- FASE 0: FRETES RURAIS (CARGA) MULTI-CARRETA
  -- Fechar vagas remanescentes vencidas (sem cancelar o frete dos motoristas já aceitos)
  -- Regra solicitada: se required_trucks > accepted_trucks e accepted_trucks > 0,
  -- ao vencer, remover as vagas restantes.
  -- Critério de vencimento: pickup_date + 48h (padrão histórico do projeto)
  -- =============================================
  FOR v_partial_rural IN
    SELECT f.id,
           f.cargo_type,
           f.service_type AS stype,
           f.origin_city,
           f.destination_city,
           f.created_at,
           f.pickup_date,
           f.required_trucks,
           f.accepted_trucks
    FROM public.freights f
    WHERE f.status = 'OPEN'
      AND UPPER(COALESCE(f.service_type, f.cargo_type)) = 'CARGA'
      AND f.accepted_trucks > 0
      AND f.required_trucks > f.accepted_trucks
      AND f.pickup_date + INTERVAL '48 hours' < NOW()
  LOOP
    v_reason := format(
      'Vagas remanescentes expiradas: %s de %s carretas não foram aceitas até 48h após a data de coleta',
      (v_partial_rural.required_trucks - v_partial_rural.accepted_trucks),
      v_partial_rural.required_trucks
    );

    BEGIN
      UPDATE public.freights
      SET
        required_trucks = accepted_trucks,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{remaining_slots_expired_at}',
          to_jsonb(NOW()),
          true
        ),
        updated_at = NOW()
      WHERE id = v_partial_rural.id;

      v_cancelled_count := v_cancelled_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao fechar vagas remanescentes do frete rural %: %', v_partial_rural.id, SQLERRM;
      CONTINUE;
    END;

    -- Registrar no histórico (não altera status, apenas nota)
    BEGIN
      INSERT INTO public.freight_status_history (
        freight_id, status, changed_by, notes, created_at
      ) VALUES (
        v_partial_rural.id,
        (SELECT status FROM public.freights WHERE id = v_partial_rural.id),
        NULL,
        v_reason,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar histórico (vagas remanescentes) frete %: %', v_partial_rural.id, SQLERRM;
    END;

    RETURN QUERY
    SELECT
      v_partial_rural.id,
      'freight_remaining_slots'::TEXT,
      COALESCE(v_partial_rural.stype, v_partial_rural.cargo_type)::TEXT,
      v_partial_rural.origin_city::TEXT,
      v_partial_rural.destination_city::TEXT,
      v_partial_rural.created_at,
      v_reason;
  END LOOP;

  -- =============================================
  -- FASE 1: CANCELAR FRETES NÃO ACEITOS VENCIDOS
  -- Regra: apenas status OPEN/IN_NEGOTIATION e accepted_trucks = 0
  -- =============================================
  FOR v_cancelled_freight IN
    SELECT f.id,
           f.cargo_type,
           f.service_type AS stype,
           f.origin_city,
           f.destination_city,
           f.created_at,
           f.pickup_date,
           f.status
    FROM public.freights f
    WHERE f.status IN ('OPEN', 'IN_NEGOTIATION')
      AND f.accepted_trucks = 0
      AND (
        -- GUINCHO: 2 horas (tempo de anúncio)
        (UPPER(COALESCE(f.service_type, f.cargo_type)) = 'GUINCHO'
          AND f.created_at + INTERVAL '2 hours' < NOW())
        OR
        -- FRETE_MOTO: 4 horas (tempo de anúncio)
        (UPPER(COALESCE(f.service_type, f.cargo_type)) = 'FRETE_MOTO'
          AND f.created_at + INTERVAL '4 hours' < NOW())
        OR
        -- MUDANCA: 48 horas (tempo de anúncio)
        (UPPER(COALESCE(f.service_type, f.cargo_type)) IN ('MUDANCA', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL')
          AND f.created_at + INTERVAL '48 hours' < NOW())
        OR
        -- CARGA (rural): vence por anúncio (72h) OU por janela de coleta (pickup_date + 48h)
        (UPPER(COALESCE(f.service_type, f.cargo_type)) = 'CARGA'
          AND (
            f.created_at + INTERVAL '72 hours' < NOW()
            OR f.pickup_date + INTERVAL '48 hours' < NOW()
          ))
        OR
        -- Urbanos/outros: 24 horas (tempo de anúncio)
        (UPPER(COALESCE(f.service_type, f.cargo_type)) NOT IN (
            'GUINCHO', 'FRETE_MOTO', 'MUDANCA', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL', 'CARGA'
          )
          AND f.created_at + INTERVAL '24 hours' < NOW())
      )
  LOOP
    CASE UPPER(COALESCE(v_cancelled_freight.stype, v_cancelled_freight.cargo_type))
      WHEN 'GUINCHO' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 2h sem aceite';
      WHEN 'FRETE_MOTO' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 4h sem aceite';
      WHEN 'MUDANCA' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 48h sem aceite';
      WHEN 'MUDANCA_RESIDENCIAL' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 48h sem aceite';
      WHEN 'MUDANCA_COMERCIAL' THEN v_reason := 'Cancelado automaticamente: anúncio expirou após 48h sem aceite';
      WHEN 'CARGA' THEN v_reason := 'Cancelado automaticamente: frete rural venceu sem nenhum aceite';
      ELSE v_reason := 'Cancelado automaticamente: anúncio expirou após 24h sem aceite';
    END CASE;

    BEGIN
      UPDATE public.freights
      SET
        status = 'CANCELLED',
        cancellation_reason = v_reason,
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE id = v_cancelled_freight.id;

      v_cancelled_count := v_cancelled_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao cancelar frete %: %', v_cancelled_freight.id, SQLERRM;
      CONTINUE;
    END;

    BEGIN
      INSERT INTO public.freight_status_history (
        freight_id, status, changed_by, notes, created_at
      ) VALUES (
        v_cancelled_freight.id,
        'CANCELLED',
        NULL,
        v_reason,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar histórico frete %: %', v_cancelled_freight.id, SQLERRM;
    END;

    RETURN QUERY
    SELECT
      v_cancelled_freight.id,
      'freight'::TEXT,
      COALESCE(v_cancelled_freight.stype, v_cancelled_freight.cargo_type)::TEXT,
      v_cancelled_freight.origin_city::TEXT,
      v_cancelled_freight.destination_city::TEXT,
      v_cancelled_freight.created_at,
      v_reason;
  END LOOP;

  -- =============================================
  -- FASE 2: CANCELAR SERVIÇOS NÃO ACEITOS VENCIDOS
  -- =============================================
  FOR v_cancelled_service IN
    SELECT s.id, s.service_type, s.location_city, s.created_at
    FROM public.service_requests s
    WHERE s.status = 'OPEN'
      AND s.created_at + INTERVAL '7 days' < NOW()
  LOOP
    v_reason := 'Cancelado automaticamente: anúncio expirou após 7 dias sem aceite';

    BEGIN
      UPDATE public.service_requests
      SET
        status = 'CANCELLED',
        cancellation_reason = v_reason,
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE id = v_cancelled_service.id;

      v_cancelled_count := v_cancelled_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao cancelar serviço %: %', v_cancelled_service.id, SQLERRM;
      CONTINUE;
    END;

    RETURN QUERY
    SELECT
      v_cancelled_service.id,
      'service'::TEXT,
      v_cancelled_service.service_type::TEXT,
      v_cancelled_service.location_city::TEXT,
      NULL::TEXT,
      v_cancelled_service.created_at,
      v_reason;
  END LOOP;

  RAISE NOTICE 'Processados % itens vencidos/ajustados (inclui fechamento de vagas remanescentes)', v_cancelled_count;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.auto_cancel_overdue_freights IS
'Cancela automaticamente apenas itens NÃO ACEITOS após prazo de expiração e fecha vagas remanescentes de fretes rurais multi-carreta.
GUINCHO: 2h | FRETE_MOTO: 4h | URBANOS: 24h | MUDANÇA: 48h | CARGA: 72h (anúncio) / pickup+48h (janela) | SERVIÇOS: 7 dias.';

-- Rodar retroativamente uma vez (para corrigir fretes já vencidos)
SELECT * FROM public.auto_cancel_overdue_freights();
