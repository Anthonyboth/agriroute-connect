-- =========================================
-- REMOVER CONSTRAINT + CRIAR SERVICE REQUESTS
-- =========================================

-- 1. Remover constraint problemática
ALTER TABLE service_requests 
DROP CONSTRAINT IF EXISTS check_provider_service_type;

-- 2. Inserir 10 service_requests de teste
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
    'PIVO_IRRIGACAO',
    'CONSULTORIA_RURAL',
    'ASSISTENCIA_TECNICA',
    'AUTOMACAO_INDUSTRIAL',
    'ENERGIA_SOLAR'
  ]),
  unnest(ARRAY[
    'Preciso de análise de solo para plantio de soja na área 12',
    'Sistema elétrico do trator apresentando falhas intermitentes',
    'Manutenção preventiva em colheitadeira John Deere',
    'Pneu furado na carreta graneleira, preciso de reparo urgente',
    'Chave quebrada na fechadura do paiol de sementes',
    'Pivô central 3 não está ligando, verificar painel elétrico',
    'Consultoria para manejo integrado de pragas na lavoura',
    'Assistência técnica em pulverizador autopropelido',
    'Instalação de sistema de automação no barracão de armazenagem',
    'Orçamento para instalação de sistema de energia solar 50kW'
  ]),
  unnest(ARRAY[
    'Fazenda São João - Área 12, Gleba A',
    'Sede da Fazenda São João',
    'Galpão de Máquinas - Setor Norte',
    'Rodovia MT-130 Km 45 - Acesso Fazenda',
    'Paiol de Sementes - Área Central',
    'Área de Irrigação - Pivô 3',
    'Escritório Administrativo da Fazenda',
    'Área de Pulverização - Galpão Sul',
    'Barracão Principal - Armazenagem',
    'Sede Administrativa'
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
    'URGENTE',
    'MEDIA',
    'ALTA',
    'MEDIA',
    'BAIXA'
  ]),
  'OPEN',
  'José da Silva - Fazenda São João',
  '(66) 99999-8888',
  CURRENT_DATE + interval '1 day' * floor(random() * 7) + interval '8 hours';