-- Verificar e corrigir RLS para quaisquer tabelas que possam estar sem proteção
-- A tabela spatial_ref_sys é do PostGIS e não precisa de RLS, mas vamos garantir que outras tabelas estejam protegidas

-- Verificar se há outras tabelas que possam ter sido criadas sem RLS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop através de todas as tabelas no schema public sem RLS
    FOR r IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = false 
        AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
    LOOP
        -- Habilitar RLS para cada tabela encontrada
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
        RAISE NOTICE 'RLS enabled for table: %', r.tablename;
    END LOOP;
END $$;

-- Corrigir as funções que podem estar sem search_path definido
-- Recriar a função update_producer_service_area_geom com search_path
CREATE OR REPLACE FUNCTION update_producer_service_area_geom()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar a geometria quando lat/lng mudam
  NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  RETURN NEW;
END;
$$;