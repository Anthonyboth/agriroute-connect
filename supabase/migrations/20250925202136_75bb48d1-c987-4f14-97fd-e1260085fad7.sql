-- CORREÇÃO FINAL DOS WARNINGS DE SEGURANÇA
-- Apenas o que podemos alterar sem tocar nas funções do PostGIS

-- 1. HABILITAR RLS EM TABELAS PÚBLICAS QUE AINDA NÃO TÊM
-- Verificar e habilitar RLS onde necessário
DO $$
DECLARE
    tbl_name text;
    tbl_names text[] := ARRAY[
        'guest_requests', 'plans', 'payments', 'user_subscriptions', 
        'service_payments', 'service_requests', 'service_provider_areas',
        'service_provider_balances', 'service_provider_payouts',
        'service_provider_payout_requests', 'producer_service_areas',
        'notifications'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY tbl_names
    LOOP
        -- Verifica se a tabela existe antes de tentar habilitar RLS
        IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl_name AND schemaname = 'public') THEN
            BEGIN
                EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_name);
                RAISE NOTICE 'RLS habilitado na tabela: %', tbl_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Não foi possível habilitar RLS na tabela %, continuando...', tbl_name;
            END;
        END IF;
    END LOOP;
END $$;

-- 2. CRIAR POLÍTICAS RLS BÁSICAS PARA TABELAS QUE EXISTEM
-- Política para guest_requests (se existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'guest_requests' AND schemaname = 'public') THEN
        BEGIN
            DROP POLICY IF EXISTS "Users can only view their own guest requests" ON public.guest_requests;
            CREATE POLICY "Users can only view their own guest requests" ON public.guest_requests
            FOR SELECT USING (
                created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
                OR is_admin()
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível criar política para guest_requests';
        END;
    END IF;
END $$;

-- 3. CORRIGIR APENAS A FUNÇÃO calculate_distance QUE É NOSSA
DO $$
BEGIN
    BEGIN
        ALTER FUNCTION public.calculate_distance(numeric, numeric, numeric, numeric) SET search_path = public;
        RAISE NOTICE 'Search path corrigido para calculate_distance';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível alterar search_path da função calculate_distance';
    END;
END $$;

-- 4. REGISTRAR AUDITORIA FINAL
INSERT INTO audit_logs (
  table_name,
  operation,
  user_id,
  new_data,
  timestamp
) VALUES (
  'security_final',
  'FINAL_SECURITY_HARDENING',
  auth.uid(),
  '{"patch": "rls_enabled_where_possible", "timestamp": "2025-01-25T20:23:00Z"}'::jsonb,
  now()
);