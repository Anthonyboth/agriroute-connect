-- Insert the missing company_drivers record for the affiliated driver that failed provisioning
INSERT INTO public.company_drivers (
  company_id,
  driver_profile_id,
  status,
  affiliation_type,
  can_accept_freights,
  can_manage_vehicles,
  notes,
  invited_at
) VALUES (
  'bed5e0f3-de64-46fe-b2b3-aaa488acc4ac',
  '5e3b5718-ebbc-47a7-8735-c75d7ba52763',
  'PENDING',
  'AFFILIATED',
  false,
  false,
  'Cadastro iniciado - aguardando aprovação (inserido manualmente após falha de provisionamento)',
  now()
)
ON CONFLICT DO NOTHING;