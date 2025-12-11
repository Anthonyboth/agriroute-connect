-- DEFAULTS para colunas existentes apenas
ALTER TABLE notifications ALTER COLUMN read SET DEFAULT false;
ALTER TABLE freights ALTER COLUMN accepted_trucks SET DEFAULT 0;
ALTER TABLE freights ALTER COLUMN required_trucks SET DEFAULT 1;
ALTER TABLE profiles ALTER COLUMN rating SET DEFAULT 0;