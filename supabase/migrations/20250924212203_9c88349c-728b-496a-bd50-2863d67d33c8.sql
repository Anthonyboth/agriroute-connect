-- Verificar e corrigir especificamente tabelas sem RLS
-- A spatial_ref_sys é do PostGIS e não deve ter RLS, mas vamos excluí-la da verificação automática

-- Habilitar RLS em todas as tabelas do public schema que não são do PostGIS
DO $$ 
DECLARE
    r RECORD;
    excluded_tables TEXT[] := ARRAY['spatial_ref_sys', 'geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews'];
BEGIN
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = false 
        AND tablename != ALL(excluded_tables)
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
            RAISE NOTICE 'RLS enabled for table: %', r.tablename;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to enable RLS for table %: %', r.tablename, SQLERRM;
        END;
    END LOOP;
END $$;