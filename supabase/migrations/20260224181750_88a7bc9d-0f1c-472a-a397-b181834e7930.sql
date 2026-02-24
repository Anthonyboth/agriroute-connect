
-- Add remaining missing MT municipalities
INSERT INTO cities (name, state, ibge_code, lat, lng) VALUES
  ('Pedra Preta', 'MT', '5106372', -16.62, -54.47),
  ('Ipiranga do Norte', 'MT', '5104526', -12.24, -56.15),
  ('Itiquira', 'MT', '5104609', -17.21, -54.14)
ON CONFLICT DO NOTHING;

-- Verify: count should be ~142
-- Also verify Itiquira specifically exists
