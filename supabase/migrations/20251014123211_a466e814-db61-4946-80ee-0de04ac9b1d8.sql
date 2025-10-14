-- Atualizar profiles de motoristas que já estão afiliados a transportadoras
UPDATE public.profiles
SET role = 'MOTORISTA_AFILIADO'
WHERE id IN (
  SELECT driver_profile_id 
  FROM company_drivers 
  WHERE status = 'ACTIVE'
)
AND role = 'MOTORISTA';