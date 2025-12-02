-- Fase 1: Adicionar Anthony Both Produtor como admin na tabela user_roles
INSERT INTO user_roles (user_id, role)
SELECT '811c36c6-7f39-4aa3-afd8-b2ba79e0b215', 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '811c36c6-7f39-4aa3-afd8-b2ba79e0b215' 
  AND role = 'admin'
);