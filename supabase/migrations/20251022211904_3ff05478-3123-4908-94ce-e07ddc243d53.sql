-- =========================================
-- PASSO 1: CORRIGIR SCHEMA (provider_id deve ser nullable)
-- =========================================
ALTER TABLE service_requests 
ALTER COLUMN provider_id DROP NOT NULL;

-- Verificar se a alteração funcionou
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'service_requests'
    AND column_name = 'provider_id'
    AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'provider_id ainda é NOT NULL após ALTER TABLE!';
  END IF;
END $$;

-- =========================================
-- PASSO 2: CRIAR SERVICE REQUESTS DE TESTE
-- =========================================
INSERT INTO service_requests (
  service_type,
  problem_description,
  location_address,
  city_name,
  state,
  location_lat,
  location_lng,
  urgency,
  status,
  contact_name,
  contact_phone,
  preferred_datetime
)
SELECT
  unnest(ARRAY[
    'AGRONOMO',
    'AUTO_ELETRICA', 
    'MECANICO',
    'BORRACHEIRO',
    'CHAVEIRO',
    'ASSISTENCIA_TECNICA',
    'CONSULTORIA_RURAL',
    'ENERGIA_SOLAR',
    'VETERINARIO',
    'TOPOGRAFIA'
  ]),
  unnest(ARRAY[
    'Preciso de análise de solo para plantio de soja na área 12',
    'Sistema elétrico do trator apresentando falhas intermitentes',
    'Manutenção preventiva em colheitadeira John Deere',
    'Pneu furado na carreta graneleira, preciso de reparo urgente',
    'Chave quebrada na fechadura do paiol de sementes',
    'Assistência técnica em pulverizador autopropelido',
    'Consultoria para manejo integrado de pragas na lavoura',
    'Orçamento para instalação de sistema de energia solar 50kW',
    'Necessito de veterinário para atendimento de rebanho',
    'Levantamento topográfico para planejamento de terraço'
  ]),
  unnest(ARRAY[
    'Fazenda São João - Área 12, Gleba A',
    'Sede da Fazenda São João',
    'Galpão de Máquinas - Setor Norte',
    'Rodovia MT-130 Km 45 - Acesso Fazenda',
    'Paiol de Sementes - Área Central',
    'Área de Pulverização - Galpão Sul',
    'Escritório Administrativo da Fazenda',
    'Sede Administrativa',
    'Curral - Área de Manejo',
    'Área de Plantio - Talhão 5'
  ]),
  'Primavera do Leste',
  'MT',
  -15.5561 + (random() * 0.1 - 0.05),
  -54.2925 + (random() * 0.1 - 0.05),
  unnest(ARRAY[
    'ALTA',
    'MEDIA',
    'ALTA',
    'URGENTE',
    'MEDIA',
    'ALTA',
    'MEDIA',
    'BAIXA',
    'URGENTE',
    'MEDIA'
  ]),
  'OPEN',
  'José da Silva - Fazenda São João',
  '(66) 99999-8888',
  CURRENT_DATE + interval '1 day' * floor(random() * 7) + interval '8 hours';