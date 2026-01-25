-- ============================================================
-- P0 FIX: Corrigir acesso à tabela service_requests via view secure
-- ============================================================
-- PROBLEMA: SELECT foi revogado de service_requests, mas a view
-- service_requests_secure precisa acessar a tabela base.
-- 
-- SOLUÇÃO: Restaurar SELECT para authenticated, as RLS policies
-- já controlam adequadamente quem pode ver quais registros.
-- ============================================================

-- 1. Restaurar SELECT privilege para authenticated
GRANT SELECT ON public.service_requests TO authenticated;

-- 2. Verificar que RLS está habilitado (já está, mas garantir)
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- 3. Garantir que a policy para clientes verem seus próprios requests existe
-- (Verificando existência primeiro para não duplicar)
DO $$
BEGIN
    -- Se a policy já existe, não fazer nada
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'service_requests' 
          AND policyname = 'p0_clients_view_own_service_requests'
    ) THEN
        -- Criar policy específica para clientes verem seus próprios requests
        CREATE POLICY "p0_clients_view_own_service_requests"
        ON public.service_requests
        FOR SELECT
        USING (
            client_id IN (
                SELECT p.id FROM public.profiles p 
                WHERE p.user_id = auth.uid()
            )
        );
    END IF;
END $$;