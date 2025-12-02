-- ========================================
-- MIGRATION: ADD SET search_path TO SECURITY DEFINER FUNCTIONS
-- ========================================
-- This migration adds SET search_path = public to all SECURITY DEFINER functions
-- to prevent search path injection attacks.
-- ========================================

-- Get all SECURITY DEFINER functions and add search_path
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all SECURITY DEFINER functions in public schema
    FOR func_record IN
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as function_args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true -- SECURITY DEFINER functions
    LOOP
        -- Add SET search_path = public to each function
        BEGIN
            EXECUTE format(
                'ALTER FUNCTION public.%I(%s) SET search_path = public',
                func_record.function_name,
                func_record.function_args
            );
            
            RAISE NOTICE 'Added search_path to function: % (%)',
                func_record.function_name,
                func_record.function_args;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to alter function % (%): %',
                func_record.function_name,
                func_record.function_args,
                SQLERRM;
        END;
    END LOOP;
END $$;

-- ========================================
-- VERIFICATION QUERY
-- Run this to verify functions were updated correctly:
-- 
-- SELECT 
--   p.proname as function_name,
--   p.prosecdef as is_security_definer,
--   pg_get_functiondef(p.oid) as function_definition
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.prosecdef = true
-- ORDER BY p.proname;
-- ========================================