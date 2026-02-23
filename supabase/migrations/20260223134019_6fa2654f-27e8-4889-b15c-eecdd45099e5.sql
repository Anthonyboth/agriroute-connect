
-- Limpar dados de motorista afiliado de teste para agrirouteconnect@gmail.com
-- Profile ID: ad0f7eeb-5813-4a25-aa76-9af12c951c45
-- User ID: f58689c0-5617-48e9-912a-73fae7df9d22

-- 1. Remover vínculo com transportadora
DELETE FROM company_drivers WHERE driver_profile_id = 'ad0f7eeb-5813-4a25-aa76-9af12c951c45';

-- 2. Remover roles anteriores
DELETE FROM user_roles WHERE user_id = 'f58689c0-5617-48e9-912a-73fae7df9d22';

-- 3. Atualizar perfil para role PRODUTOR (neutro, com auto-approve)
UPDATE profiles 
SET role = 'PRODUTOR',
    status = 'APPROVED',
    updated_at = now()
WHERE id = 'ad0f7eeb-5813-4a25-aa76-9af12c951c45';

-- 4. Inserir role producer na user_roles (trigger de sync vai criar automaticamente, mas garantimos)
INSERT INTO user_roles (user_id, role)
VALUES ('f58689c0-5617-48e9-912a-73fae7df9d22', 'producer')
ON CONFLICT (user_id, role) DO NOTHING;
