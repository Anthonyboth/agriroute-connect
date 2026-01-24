
-- =============================================================
-- FIX: profiles_active_mode_check constraint is too restrictive
-- Current: CHECK (active_mode IN ('MOTORISTA', 'TRANSPORTADORA'))
-- Needed: CHECK (active_mode IN all user_role enum values)
-- =============================================================

-- Step 1: Drop the incorrect constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_active_mode_check;

-- Step 2: Add the corrected constraint with ALL valid roles
-- This matches all values from the user_role enum
ALTER TABLE public.profiles ADD CONSTRAINT profiles_active_mode_check 
CHECK (
  active_mode IS NULL 
  OR active_mode = ANY (ARRAY[
    'PRODUTOR'::text, 
    'MOTORISTA'::text, 
    'MOTORISTA_AFILIADO'::text,
    'PRESTADOR_SERVICOS'::text, 
    'TRANSPORTADORA'::text
  ])
);

-- Step 3: Add a comment explaining the constraint
COMMENT ON CONSTRAINT profiles_active_mode_check ON public.profiles IS 
'Ensures active_mode matches valid user_role enum values. Updated 2026-01-24 to include all roles: PRODUTOR, MOTORISTA, MOTORISTA_AFILIADO, PRESTADOR_SERVICOS, TRANSPORTADORA';

-- Step 4: Verify the constraint was applied correctly
DO $$
DECLARE
  v_constraint_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_constraint_def
  FROM pg_constraint 
  WHERE conname = 'profiles_active_mode_check';
  
  IF v_constraint_def IS NULL THEN
    RAISE EXCEPTION 'Constraint profiles_active_mode_check was not created!';
  END IF;
  
  -- Verify all roles are included
  IF v_constraint_def NOT LIKE '%PRODUTOR%' 
     OR v_constraint_def NOT LIKE '%MOTORISTA%'
     OR v_constraint_def NOT LIKE '%PRESTADOR_SERVICOS%'
     OR v_constraint_def NOT LIKE '%TRANSPORTADORA%' THEN
    RAISE EXCEPTION 'Constraint is missing some roles! Definition: %', v_constraint_def;
  END IF;
  
  RAISE NOTICE 'Constraint verified successfully: %', v_constraint_def;
END;
$$;
