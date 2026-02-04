
-- Atualizar a função scan_policies_for_role_references para detecção mais precisa
CREATE OR REPLACE FUNCTION public.scan_policies_for_role_references()
 RETURNS TABLE(object_type text, object_name text, violation_type text, violation_details text, recommendation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Escanear policies usando profiles.role DIRETAMENTE (sem has_role)
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
    AND qual LIKE '%profiles%role%'
    AND qual NOT LIKE '%has_role%'
    AND qual NOT LIKE '%get_user_role%';

  -- 2. Detectar policies com with_check usando profiles.role
  RETURN QUERY
  SELECT 
    'POLICY'::TEXT,
    schemaname || '.' || tablename || '.' || policyname,
    'PROFILES_ROLE_CHECK'::TEXT,
    with_check::TEXT,
    'Replace with: public.has_role(auth.uid(), ''role''::app_role)'::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
    AND with_check IS NOT NULL
    AND with_check LIKE '%profiles%role%'
    AND with_check NOT LIKE '%has_role%'
    AND with_check NOT LIKE '%get_user_role%';

  -- 3. Detectar policies DUPLICADAS (mesmo cmd e tabela) - apenas informativo
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
$function$;
