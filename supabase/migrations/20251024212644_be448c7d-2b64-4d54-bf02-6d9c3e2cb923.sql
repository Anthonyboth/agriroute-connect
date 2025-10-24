-- ============================================
-- RLS Policy para Transportadoras verem Marketplace
-- ============================================
-- Esta policy permite que usuários autenticados (transportadoras)
-- vejam fretes disponíveis no marketplace (sem company_id atribuído)
-- que estão em status abertos para aceite

-- IMPORTANTE: Esta policy é segura pois:
-- 1. Só expõe fretes SEM company_id (marketplace público)
-- 2. Só expõe fretes em status abertos (não finalizados/cancelados)
-- 3. Não expõe dados de fretes já atribuídos a outras empresas

-- Verificar se RLS está habilitado (não modifica se já estiver)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'freights'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.freights ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Criar policy de leitura do marketplace para transportadoras
-- Drop se já existir para evitar conflitos
DROP POLICY IF EXISTS "transportadoras_podem_ver_marketplace" ON public.freights;

CREATE POLICY "transportadoras_podem_ver_marketplace"
ON public.freights
FOR SELECT
TO authenticated
USING (
  -- Apenas fretes do marketplace (sem transportadora atribuída)
  company_id IS NULL
  AND 
  -- Apenas status que indicam disponibilidade (excluindo PENDING pois não existe no enum)
  status IN ('OPEN', 'ACCEPTED', 'IN_NEGOTIATION')
);