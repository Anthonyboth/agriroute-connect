-- Corrigir funções específicas identificadas sem search_path
ALTER FUNCTION public.get_secure_service_request_details(uuid) SET search_path TO 'public';
ALTER FUNCTION public.mask_service_request_data() SET search_path TO 'public';
ALTER FUNCTION public.cleanup_expired_requests() SET search_path TO 'public';
ALTER FUNCTION public.remove_advance_payment_requirement() SET search_path TO 'public';
ALTER FUNCTION public.check_advance_payment_requirement() SET search_path TO 'public';
ALTER FUNCTION public.log_antt_usage() SET search_path TO 'public';

-- Verificar e corrigir tabelas sem RLS
DO $$
DECLARE
    tbl RECORD;
BEGIN
    -- Lista de tabelas que precisam de RLS 
    FOR tbl IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = false
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tbl.schemaname, tbl.tablename);
        RAISE NOTICE 'Habilitado RLS para tabela: %.%', tbl.schemaname, tbl.tablename;
    END LOOP;
END
$$;