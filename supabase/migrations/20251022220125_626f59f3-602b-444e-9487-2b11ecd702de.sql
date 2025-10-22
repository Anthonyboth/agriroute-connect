-- 1. CORRIGIR RLS POLICY para permitir auto-cadastro de motoristas afiliados
DROP POLICY IF EXISTS company_drivers_insert ON public.company_drivers;

CREATE POLICY company_drivers_insert
ON public.company_drivers
FOR INSERT
TO authenticated
WITH CHECK (
  -- Transportadora pode adicionar motoristas
  public.can_manage_company(auth.uid(), company_id)
  OR 
  -- Motorista pode se auto-cadastrar COM STATUS PENDING
  (
    driver_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND status = 'PENDING'
  )
  OR 
  -- Admins podem tudo
  public.is_admin()
);

-- 2. REPARAR MOTORISTAS ÓRFÃOS: vincular à Tatinha Transportes
INSERT INTO company_drivers (
  company_id,
  driver_profile_id,
  status,
  can_accept_freights,
  can_manage_vehicles,
  affiliation_type,
  notes
)
SELECT 
  '76bc21ba-a7ba-48a7-8238-07a841de5759'::uuid, -- ID da Tatinha Transportes
  p.id,
  'PENDING',
  false,
  false,
  'AFFILIATED',
  'Cadastro recuperado - aguardando aprovação'
FROM profiles p
WHERE 
  p.role = 'MOTORISTA_AFILIADO'
  AND p.status = 'PENDING'
  AND NOT EXISTS (
    SELECT 1 FROM company_drivers cd 
    WHERE cd.driver_profile_id = p.id
  )
LIMIT 3;

-- 3. CRIAR NOTIFICAÇÕES para a transportadora sobre motoristas pendentes
INSERT INTO notifications (
  user_id,
  title,
  message,
  type,
  data
)
SELECT 
  '1915a47d-cf24-478a-ac30-f176be8ef6f3'::uuid, -- profile_id da Tatinha
  'Novas Solicitações de Motoristas',
  'Você tem ' || COUNT(*)::text || ' motorista(s) aguardando aprovação',
  'driver_approval_pending',
  jsonb_build_object(
    'count', COUNT(*),
    'requires_action', true
  )
FROM company_drivers cd
WHERE 
  cd.company_id = '76bc21ba-a7ba-48a7-8238-07a841de5759'
  AND cd.status = 'PENDING'
  AND cd.notes = 'Cadastro recuperado - aguardando aprovação'
HAVING COUNT(*) > 0;