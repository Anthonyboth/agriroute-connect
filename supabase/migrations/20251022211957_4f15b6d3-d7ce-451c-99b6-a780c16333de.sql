-- =========================================
-- REMOVER CONSTRAINT PROBLEMÁTICA E INSERIR DADOS
-- =========================================

-- Remover constraint que está bloqueando inserções sem provider
ALTER TABLE service_requests
DROP CONSTRAINT IF EXISTS check_provider_service_type;

-- Inserir 10 service_requests de teste
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
VALUES
  ('AGRONOMO', 'Preciso de análise de solo para plantio de soja na área 12', 'Fazenda São João - Área 12, Gleba A', 'Primavera do Leste', 'MT', -15.5561, -54.2925, 'ALTA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '1 day'),
  ('AUTO_ELETRICA', 'Sistema elétrico do trator apresentando falhas intermitentes', 'Sede da Fazenda São João', 'Primavera do Leste', 'MT', -15.5571, -54.2935, 'MEDIA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '2 days'),
  ('MECANICO', 'Manutenção preventiva em colheitadeira John Deere', 'Galpão de Máquinas - Setor Norte', 'Primavera do Leste', 'MT', -15.5551, -54.2915, 'ALTA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '3 days'),
  ('BORRACHEIRO', 'Pneu furado na carreta graneleira, preciso de reparo urgente', 'Rodovia MT-130 Km 45', 'Primavera do Leste', 'MT', -15.5581, -54.2945, 'URGENTE', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '1 day'),
  ('CHAVEIRO', 'Chave quebrada na fechadura do paiol de sementes', 'Paiol de Sementes - Área Central', 'Primavera do Leste', 'MT', -15.5541, -54.2905, 'MEDIA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '4 days'),
  ('PIVO_IRRIGACAO', 'Pivô central 3 não está ligando, verificar painel elétrico', 'Área de Irrigação - Pivô 3', 'Primavera do Leste', 'MT', -15.5591, -54.2955, 'URGENTE', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '1 day'),
  ('CONSULTORIA_RURAL', 'Consultoria para manejo integrado de pragas na lavoura', 'Escritório da Fazenda', 'Primavera do Leste', 'MT', -15.5531, -54.2895, 'MEDIA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '5 days'),
  ('ASSISTENCIA_TECNICA', 'Assistência técnica em pulverizador autopropelido', 'Área de Pulverização - Galpão Sul', 'Primavera do Leste', 'MT', -15.5601, -54.2965, 'ALTA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '2 days'),
  ('AUTOMACAO_INDUSTRIAL', 'Instalação de sistema de automação no barracão de armazenagem', 'Barracão Principal', 'Primavera do Leste', 'MT', -15.5521, -54.2885, 'MEDIA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '6 days'),
  ('ENERGIA_SOLAR', 'Orçamento para instalação de sistema de energia solar 50kW', 'Sede Administrativa', 'Primavera do Leste', 'MT', -15.5611, -54.2975, 'BAIXA', 'OPEN', 'José da Silva', '(66) 99999-8888', CURRENT_TIMESTAMP + interval '7 days');