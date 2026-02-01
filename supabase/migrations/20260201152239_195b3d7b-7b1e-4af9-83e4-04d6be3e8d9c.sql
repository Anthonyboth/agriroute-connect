-- Vincular o motorista afiliado à transportadora RS Transportes
INSERT INTO public.company_drivers (
  company_id,
  driver_profile_id,
  invited_by,
  status,
  affiliation_type,
  can_accept_freights,
  can_manage_vehicles,
  accepted_at,
  created_at,
  updated_at
) VALUES (
  '42434853-5b48-4ee3-9de3-caf551cefcf3', -- RS Transportes company_id
  'ad0f7eeb-5813-4a25-aa76-9af12c951c45', -- Profile ID do motorista recém-criado
  '06812bbb-212e-4b4c-b4f2-2fc16f9094c5', -- profile_id da transportadora
  'ACTIVE',
  'AFFILIATED',
  true,
  true,
  NOW(),
  NOW(),
  NOW()
)
RETURNING id, company_id, driver_profile_id, status;