-- Inserir registros básicos em service_providers para prestadores existentes
-- que possuem role PRESTADOR_SERVICOS mas não têm entrada na tabela service_providers
-- A cláusula NOT EXISTS já previne duplicatas

INSERT INTO public.service_providers (
  profile_id,
  service_type,
  service_radius_km,
  emergency_service,
  works_weekends,
  works_holidays
)
SELECT 
  p.id,
  'GUINCHO',
  50,
  true,
  true,
  false
FROM profiles p
WHERE p.role = 'PRESTADOR_SERVICOS'
  AND NOT EXISTS (
    SELECT 1 FROM service_providers sp WHERE sp.profile_id = p.id
  );