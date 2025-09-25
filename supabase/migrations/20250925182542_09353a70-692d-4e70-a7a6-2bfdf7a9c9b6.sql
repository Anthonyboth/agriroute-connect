-- Corrigir funções sem search_path definido
ALTER FUNCTION public.encrypt_sensitive_data(text, text) SET search_path TO 'public';
ALTER FUNCTION public.decrypt_sensitive_data(text, text) SET search_path TO 'public';

-- Habilitar RLS em qualquer tabela pública que possa estar sem
-- (verificando se existe alguma tabela sem RLS)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename 
             FROM pg_tables 
             WHERE schemaname = 'public' 
             AND tablename NOT IN (
                 SELECT schemaname||'.'||tablename 
                 FROM pg_policies 
                 WHERE schemaname = 'public'
             )
    LOOP
        -- Habilita RLS apenas em tabelas que não são de sistema
        IF r.tablename NOT LIKE 'pg_%' AND r.tablename NOT LIKE 'spatial_ref_sys' THEN
            EXECUTE 'ALTER TABLE ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
        END IF;
    END LOOP;
END
$$;