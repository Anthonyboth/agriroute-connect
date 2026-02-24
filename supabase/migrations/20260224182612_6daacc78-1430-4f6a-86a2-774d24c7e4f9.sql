
-- Fix: Novo São Joaquim has wrong IBGE code (should be 5106281, not 5106372)
UPDATE cities SET ibge_code = '5106281' WHERE name = 'Novo São Joaquim' AND state = 'MT' AND ibge_code = '5106372';

-- Now insert Pedra Preta with the correct IBGE code
INSERT INTO cities (name, state, ibge_code, lat, lng) VALUES
  ('Pedra Preta', 'MT', '5106372', -16.62, -54.47)
ON CONFLICT DO NOTHING;
