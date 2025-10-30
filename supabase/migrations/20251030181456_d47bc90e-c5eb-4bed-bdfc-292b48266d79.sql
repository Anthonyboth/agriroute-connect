-- ============================================================================
-- HOTFIX: Resolve production statement timeouts when updating freight status
-- ============================================================================
--
-- This migration adds fast-fail lock handling to prevent statement timeouts
-- when updating freight status due to row lock contention.
--
-- Changes:
-- 1. Helper function to convert text → freight_status enum
-- 2. Main RPC update_freight_status with NOWAIT lock and timeout guards
-- 3. Wrapper RPC update_freight_status_text for text input tolerance
-- 4. Operational diagnostics comments for troubleshooting locks
--
-- ============================================================================

-- ============================================================================
-- PART 1: Text to Enum Conversion Helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public.text_to_freight_status(p_status_text TEXT)
RETURNS public.freight_status
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  -- Convert text to uppercase and cast to freight_status enum
  -- This handles case-insensitive input
  RETURN UPPER(TRIM(p_status_text))::public.freight_status;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid freight status: %. Valid values are: OPEN, IN_NEGOTIATION, ACCEPTED, LOADING, LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION, DELIVERED, COMPLETED, CANCELLED', p_status_text;
END;
$$;

COMMENT ON FUNCTION public.text_to_freight_status IS
'Safely converts text to freight_status enum. Case-insensitive. Raises exception for invalid values.';

-- ============================================================================
-- PART 2: Main Update Freight Status RPC with Fast-Fail Lock Handling
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_freight_status(
  p_id UUID,
  p_status public.freight_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_producer_id UUID;
  v_current_status public.freight_status;
  v_rows_updated INTEGER;
BEGIN
  -- Set local timeouts to fail fast
  SET LOCAL lock_timeout = '2s';
  SET LOCAL statement_timeout = '10s';

  -- Try to lock the specific row upfront with NOWAIT
  -- This fails immediately (SQLSTATE 55P03) if another transaction holds the lock
  BEGIN
    SELECT 1 FROM public.freights 
    WHERE id = p_id 
    FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      -- SQLSTATE 55P03
      RETURN jsonb_build_object(
        'success', false,
        'error', 'FREIGHT_BUSY',
        'message', 'Este frete está sendo atualizado por outra operação. Tente novamente em alguns segundos.'
      );
  END;

  -- Get current freight data for permission check and status validation
  SELECT driver_id, producer_id, status
  INTO v_driver_id, v_producer_id, v_current_status
  FROM public.freights
  WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'FREIGHT_NOT_FOUND',
      'message', 'Frete não encontrado.'
    );
  END IF;

  -- Permission check: user must be driver or producer of this freight
  IF NOT (auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE id = v_driver_id
    UNION
    SELECT user_id FROM public.profiles WHERE id = v_producer_id
  )) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PERMISSION_DENIED',
      'message', 'Você não tem permissão para atualizar este frete.'
    );
  END IF;

  -- Perform the UPDATE
  UPDATE public.freights
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE id = p_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UPDATE_FAILED',
      'message', 'Falha ao atualizar o frete.'
    );
  END IF;

  -- Success
  RETURN jsonb_build_object(
    'success', true,
    'freight_id', p_id,
    'old_status', v_current_status,
    'new_status', p_status,
    'message', 'Status atualizado com sucesso.'
  );

EXCEPTION
  WHEN others THEN
    -- Catch any unexpected errors
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNEXPECTED_ERROR',
      'message', 'Erro inesperado: ' || SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_freight_status(UUID, public.freight_status) TO authenticated;

COMMENT ON FUNCTION public.update_freight_status IS
'Update freight status with fast-fail lock handling. 
Uses NOWAIT to fail immediately if row is locked (returns FREIGHT_BUSY error within ~2s).
Checks permissions (driver or producer only).
SECURITY DEFINER - runs with function owner privileges.

Performance characteristics:
- Typical execution: <100ms when no lock contention
- Lock wait: fails within 2s (lock_timeout)
- Max execution: 10s (statement_timeout)

Troubleshooting lock contention:
-- Find blocking queries:
SELECT 
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocker.pid AS blocker_pid,
  blocker.query AS blocker_query,
  blocker.state AS blocker_state
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocker ON blocker.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.query LIKE ''%update_freight_status%'';

-- Kill blocking session (use with caution):
-- SELECT pg_terminate_backend(<blocker_pid>);
';

-- ============================================================================
-- PART 3: Wrapper RPC for Text Input (Delegates to Typed Version)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_freight_status_text(
  p_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_enum public.freight_status;
BEGIN
  -- Convert text to enum using helper function
  BEGIN
    v_status_enum := public.text_to_freight_status(p_status);
  EXCEPTION
    WHEN others THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_STATUS',
        'message', 'Status inválido: ' || p_status || '. Valores válidos: OPEN, IN_NEGOTIATION, ACCEPTED, LOADING, LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION, DELIVERED, COMPLETED, CANCELLED'
      );
  END;

  -- Delegate to the typed version
  RETURN public.update_freight_status(p_id, v_status_enum);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_freight_status_text(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_freight_status_text IS
'Text-input wrapper for update_freight_status. 
Converts text → freight_status enum via text_to_freight_status helper.
Delegates to typed RPC for actual update.
Benefits from the same fast-fail lock behavior.
SECURITY DEFINER - runs with function owner privileges.';

-- ============================================================================
-- PART 4: Ensure Primary Key Exists (Idempotent Check)
-- ============================================================================
-- Note: The freights table already has PRIMARY KEY on id from the initial migration
-- This block ensures it exists without causing errors if already present

DO $$
BEGIN
  -- Check if primary key constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'freights'
      AND c.contype = 'p'
  ) THEN
    -- This should never execute as freights already has a PK, but included for safety
    ALTER TABLE public.freights ADD PRIMARY KEY (id);
    RAISE NOTICE 'Added primary key to freights(id)';
  ELSE
    RAISE NOTICE 'Primary key already exists on freights(id) - no action needed';
  END IF;
END $$;

-- ============================================================================
-- OPERATIONAL NOTES
-- ============================================================================
--
-- DIAGNOSTIC QUERIES for troubleshooting lock contention:
--
-- 1. Find current locks on freights table:
-- SELECT 
--   l.locktype, 
--   l.relation::regclass, 
--   l.mode, 
--   l.granted,
--   a.pid,
--   a.usename,
--   a.query,
--   a.state,
--   a.state_change
-- FROM pg_locks l
-- JOIN pg_stat_activity a ON l.pid = a.pid
-- WHERE l.relation = 'public.freights'::regclass
-- ORDER BY l.granted, a.state_change;
--
-- 2. Identify blocking relationships:
-- SELECT 
--   blocked.pid AS blocked_pid,
--   blocked.usename AS blocked_user,
--   blocked.query AS blocked_query,
--   blocker.pid AS blocker_pid,
--   blocker.usename AS blocker_user,
--   blocker.query AS blocker_query,
--   blocker.state AS blocker_state
-- FROM pg_stat_activity blocked
-- JOIN pg_stat_activity blocker ON blocker.pid = ANY(pg_blocking_pids(blocked.pid))
-- WHERE blocked.datname = current_database();
--
-- 3. Find long-running transactions:
-- SELECT 
--   pid,
--   usename,
--   state,
--   NOW() - xact_start AS duration,
--   query
-- FROM pg_stat_activity
-- WHERE state != 'idle'
--   AND NOW() - xact_start > INTERVAL '5 seconds'
-- ORDER BY duration DESC;
--
-- ============================================================================
