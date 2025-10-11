-- Inserir principais portos e polos logísticos estratégicos
INSERT INTO cities (name, state, lat, lng, ibge_code) VALUES
-- PORTOS MARÍTIMOS
('Paranaguá', 'PR', -25.5163, -48.5092, '4118204'),
('Rio Grande', 'RS', -32.0350, -52.0986, '4315602'),
('Itajaí', 'SC', -26.9078, -48.6619, '4208203'),
('Suape', 'PE', -8.3917, -35.0064, NULL),
('São Francisco do Sul', 'SC', -26.2431, -48.6381, '4216602'),
('Vila Velha', 'ES', -20.3297, -40.2925, '3205200'),
('Itaguaí', 'RJ', -22.8519, -43.7753, '3301900'),
('São Sebastião', 'SP', -23.8036, -45.4097, '3550308'),

-- PORTOS FLUVIAIS IMPORTANTES
('Porto Velho', 'RO', -8.7612, -63.9004, '1100205'),
('Santarém', 'PA', -2.4419, -54.7081, '1506807'),
('Corumbá', 'MS', -19.0078, -57.6547, '5003207'),

-- PRINCIPAIS CIDADES DO AGRONEGÓCIO MT
('Alta Floresta', 'MT', -9.8658, -56.0861, '5100250'),
('Guarantã do Norte', 'MT', -9.9642, -54.9094, '5104104'),
('Juína', 'MT', -11.3856, -58.7456, '5105150'),
('Juara', 'MT', -11.2544, -57.5086, '5105101'),
('Confresa', 'MT', -10.6417, -51.5653, '5103353'),
('Água Boa', 'MT', -14.0511, -52.1606, '5100201'),
('Querência', 'MT', -12.6072, -52.1881, '5107065'),
('Pontes e Lacerda', 'MT', -15.2261, -59.3353, '5106752'),
('Vila Bela da Santíssima Trindade', 'MT', -15.0033, -59.9517, '5105507'),
('Comodoro', 'MT', -13.6642, -59.7886, '5103304'),
('Sapezal', 'MT', -13.5481, -58.7669, '5107875'),
('Campos de Júlio', 'MT', -13.7328, -59.2878, '5102686'),
('Nova Ubiratã', 'MT', -13.0128, -55.2594, '5106273'),
('Feliz Natal', 'MT', -12.3881, -54.9239, '5103700'),
('Nova Mutum', 'MT', -13.8361, -56.0831, '5106224'),
('Campo Verde', 'MT', -15.5458, -55.1644, '5102678'),
('Primavera do Leste', 'MT', -15.5561, -54.2958, '5107040'),
('Canarana', 'MT', -13.5544, -52.2708, '5102603'),
('Barra do Garças', 'MT', -15.8906, -52.2567, '5101803'),
('Tangará da Serra', 'MT', -14.6228, -57.4933, '5107958'),
('Diamantino', 'MT', -14.4086, -56.4456, '5103502'),
('Paranatinga', 'MT', -14.4281, -54.0489, '5106307'),
('Brasnorte', 'MT', -12.1481, -57.9819, '5101902'),
('Novo São Joaquim', 'MT', -14.8556, -53.0147, '5106372'),

-- ENTRONCAMENTOS RODOVIÁRIOS ESTRATÉGICOS
('Maringá', 'PR', -23.4205, -51.9333, '4115200'),
('Londrina', 'PR', -23.3045, -51.9696, '4113700'),
('Cascavel', 'PR', -24.9558, -53.4553, '4104808'),
('Dourados', 'MS', -22.2211, -54.8056, '5003702'),
('Ribeirão Preto', 'SP', -21.1704, -47.8103, '3543402'),
('Uberlândia', 'MG', -18.9186, -48.2772, '3170206'),
('Anápolis', 'GO', -16.3281, -48.9531, '5201108'),
('Feira de Santana', 'BA', -12.2664, -38.9663, '2910800'),

-- CAPITAIS FALTANTES
('Aracaju', 'SE', -10.9091, -37.0677, '2800308'),
('Maceió', 'AL', -9.6658, -35.7350, '2704302'),
('João Pessoa', 'PB', -7.1195, -34.8450, '2507507'),
('Natal', 'RN', -5.7945, -35.2110, '2408102'),
('Teresina', 'PI', -5.0892, -42.8019, '2211001'),
('São Luís', 'MA', -2.5297, -44.3028, '2111300'),
('Macapá', 'AP', 0.0349, -51.0694, '1600303'),
('Boa Vista', 'RR', 2.8235, -60.6758, '1400100'),
('Rio Branco', 'AC', -9.9754, -67.8243, '1200401'),
('Palmas', 'TO', -10.1689, -48.3317, '1721000'),
('Campo Grande', 'MS', -20.4697, -54.6201, '5002704'),
('Florianópolis', 'SC', -27.5954, -48.5480, '4205407'),
('Porto Alegre', 'RS', -30.0346, -51.2177, '4314902'),
('Fortaleza', 'CE', -3.7172, -38.5433, '2304400'),
('Recife', 'PE', -8.0476, -34.8770, '2611606'),
('Salvador', 'BA', -12.9714, -38.5014, '2927408'),
('Belo Horizonte', 'MG', -19.9167, -43.9345, '3106200'),
('Goiânia', 'GO', -16.6864, -49.2643, '5208707')

ON CONFLICT (name, state) DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  ibge_code = EXCLUDED.ibge_code;

-- Criar índices para melhor performance de busca
CREATE INDEX IF NOT EXISTS idx_cities_search 
ON cities USING gin(to_tsvector('portuguese', name || ' ' || state));

CREATE INDEX IF NOT EXISTS idx_cities_state 
ON cities(state);

CREATE INDEX IF NOT EXISTS idx_cities_name 
ON cities(name);

-- Função para listar cidades que precisam de geocoding
CREATE OR REPLACE FUNCTION cities_needing_geocoding()
RETURNS TABLE (
  id uuid,
  name text,
  state text
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, state 
  FROM cities 
  WHERE lat IS NULL OR lng IS NULL
  ORDER BY state, name;
$$;

-- Melhorar função search_cities com priorização de cidades importantes
CREATE OR REPLACE FUNCTION search_cities(
  search_term text,
  limit_count integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  name text,
  state text,
  display_name text,
  lat numeric,
  lng numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.state,
    (c.name || ', ' || c.state) as display_name,
    c.lat,
    c.lng
  FROM cities c
  WHERE 
    c.name ILIKE search_term || '%'
    OR c.name ILIKE '%' || search_term || '%'
    OR c.state ILIKE '%' || search_term || '%'
    OR (c.name || ', ' || c.state) ILIKE '%' || search_term || '%'
    OR to_tsvector('portuguese', c.name || ' ' || c.state) @@ 
       plainto_tsquery('portuguese', search_term)
  ORDER BY 
    -- Priorizar matches exatos no início
    CASE 
      WHEN LOWER(c.name) = LOWER(search_term) THEN 1
      WHEN c.name ILIKE search_term || '%' THEN 2
      WHEN c.state ILIKE search_term || '%' THEN 3
      WHEN c.name ILIKE '%' || search_term || '%' THEN 4
      ELSE 5
    END,
    -- Priorizar capitais e cidades importantes
    CASE 
      WHEN c.name IN (
        'São Paulo', 'Rio de Janeiro', 'Brasília', 'Cuiabá', 'Rondonópolis',
        'Porto Alegre', 'Belo Horizonte', 'Salvador', 'Fortaleza', 'Manaus',
        'Sinop', 'Sorriso', 'Lucas do Rio Verde', 'Primavera do Leste',
        'Paranaguá', 'Rio Grande', 'Itajaí', 'Santos', 'Vitória'
      ) THEN 1
      ELSE 2
    END,
    c.name
  LIMIT limit_count;
END;
$$;