-- Criar perfil para o motorista afiliado que está sem perfil
-- Dados do auth.users: user_id=f58689c0-5617-48e9-912a-73fae7df9d22, email=agrirouteconnect@gmail.com
INSERT INTO public.profiles (
  user_id,
  full_name,
  email,
  phone,
  document,
  cpf_cnpj,
  role,
  active_mode,
  status,
  background_check_status,
  created_at,
  updated_at
) VALUES (
  'f58689c0-5617-48e9-912a-73fae7df9d22',
  'Anthony Motorista 3',
  'agrirouteconnect@gmail.com',
  '66999426656',
  '13523053307',
  '13523053307',
  'MOTORISTA_AFILIADO',
  'MOTORISTA_AFILIADO',
  'APPROVED',
  'APPROVED',
  NOW(),
  NOW()
)
RETURNING id, user_id, full_name, role, status;