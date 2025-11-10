-- =====================================================================
-- REVERTER MUDANÇAS PROBLEMÁTICAS NAS POLICIES DE FREIGHTS
-- =====================================================================

-- 1️⃣ REMOVER as 3 policies ERRADAS que criei
DROP POLICY IF EXISTS "Admins can view all freights" ON freights;
DROP POLICY IF EXISTS "Drivers and transport companies can view relevant freights" ON freights;
DROP POLICY IF EXISTS "Producers can view their freights" ON freights;

-- 2️⃣ ADICIONAR apenas a policy de admin (usando has_role corretamente)
CREATE POLICY "Admins can view all freights"
ON freights FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3️⃣ Verificar que as policies antigas ainda existem e estão ativas
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'freights'
    AND policyname IN (
      'producer_own_freights_select',
      'driver_assigned_freights_select',
      'company_own_freights_select',
      'transportadoras_podem_ver_marketplace'
    );
    
  IF policy_count < 4 THEN
    RAISE EXCEPTION 'ERRO: Policies antigas não encontradas. Revisar migration anterior.';
  END IF;
  
  RAISE NOTICE 'Verificação OK: % policies antigas encontradas', policy_count;
END $$;

-- 4️⃣ Atualizar função de scan para detectar policies duplicadas
CREATE OR REPLACE FUNCTION scan_policies_for_role_references()
RETURNS TABLE (
  object_type TEXT,
  object_name TEXT,
  violation_type TEXT,
  violation_details TEXT,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Escanear policies usando profiles.role
  RETURN QUERY
  SELECT 
    'POLICY'::TEXT,
    schemaname || '.' || tablename || '.' || policyname,
    'PROFILES_ROLE_CHECK'::TEXT,
    qual::TEXT,
    'Replace with: public.has_role(auth.uid(), ''role''::app_role)'::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
    AND qual IS NOT NULL
    AND (
      qual LIKE '%profiles.role%'
      AND policyname NOT LIKE '%own_%'
      AND policyname NOT LIKE '%assigned_%'
    );

  -- 2. Detectar policies DUPLICADAS (mesmo cmd e tabela)
  RETURN QUERY
  SELECT 
    'POLICY'::TEXT,
    schemaname || '.' || tablename,
    'DUPLICATE_POLICIES'::TEXT,
    'Found ' || COUNT(*)::TEXT || ' policies with similar functionality: ' || STRING_AGG(policyname, ', '),
    'Review and consolidate duplicate policies'::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename, cmd
  HAVING COUNT(*) > 3;
END;
$$;