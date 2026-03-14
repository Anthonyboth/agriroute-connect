
INSERT INTO public.insurance_products (name, category, description, coverage_details, exclusions, min_price, max_price, max_coverage, pricing_model) VALUES
('Seguro de Carga Agrícola', 'transporte', 
 'Proteção completa para cargas agrícolas durante o transporte, incluindo grãos, insumos e produtos perecíveis.',
 '• Roubo e furto qualificado\n• Tombamento do veículo\n• Colisão e capotamento\n• Incêndio e explosão\n• Alagamento e fenômenos naturais\n• Avarias durante carga/descarga',
 '• Desgaste natural da carga\n• Embalagem inadequada pelo embarcador\n• Vício próprio do produto\n• Contrabando e mercadoria ilegal\n• Guerra e atos terroristas',
 0.8, 2.5, 5000000, 'percentage'),

('Frete Garantido', 'operacional',
 'Garantia financeira em caso de cancelamento ou não conclusão do frete. Protege seu faturamento.',
 '• Cancelamento pelo contratante após carregamento\n• Impossibilidade de entrega por bloqueio de estrada\n• Quebra mecânica que impeça conclusão\n• Reembolso de custos operacionais\n• Cobertura de diárias paradas',
 '• Cancelamento voluntário pelo motorista\n• Frete não iniciado\n• Atraso por responsabilidade do motorista\n• Documentação irregular',
 1.5, 3, 100000, 'percentage'),

('Responsabilidade Civil Transportador', 'profissional',
 'Cobertura obrigatória RCTR-C para transportadores. Protege contra danos a terceiros durante o transporte.',
 '• Danos materiais a terceiros\n• Danos corporais a terceiros\n• Custos judiciais e honorários\n• Poluição ambiental acidental\n• Limpeza de vias em caso de acidente',
 '• Danos ao próprio veículo\n• Multas e penalidades\n• Danos intencionais\n• Operação sem documentação válida',
 120, 600, 1000000, 'monthly'),

('Roubo de Carga', 'transporte',
 'Proteção especializada contra roubo e furto de cargas em rodovias e áreas de risco.',
 '• Roubo com uso de violência\n• Furto qualificado\n• Apropriação indébita\n• Desvio de carga\n• Estelionato\n• Rastreamento e recuperação',
 '• Furto simples sem arrombamento\n• Carga não declarada\n• Falta de rastreador ativo\n• Rotas não autorizadas\n• Estacionamento irregular',
 1.5, 4, 3000000, 'percentage'),

('Equipamentos Agrícolas em Trânsito', 'transporte',
 'Seguro para transporte de máquinas e equipamentos agrícolas de alto valor.',
 '• Colheitadeiras e tratores\n• Implementos agrícolas\n• Peças e componentes\n• Danos por vibração\n• Queda durante carregamento\n• Cobertura porta a porta',
 '• Desgaste natural\n• Manutenção inadequada\n• Falta de amarração conforme norma\n• Equipamento sem nota fiscal',
 1, 3, 10000000, 'percentage'),

('Assistência 24h Caminhoneiro', 'operacional',
 'Pacote completo de assistência emergencial para caminhoneiros em qualquer rodovia do Brasil.',
 '• Guincho ilimitado (até 200km)\n• Troca de pneu emergencial\n• Pane seca (combustível)\n• Chaveiro 24h\n• Hospedagem (até 3 diárias)\n• Retorno ao domicílio\n• Assistência mecânica no local',
 '• Serviços em vias não pavimentadas\n• Reparos complexos no local\n• Transporte de carga perecível\n• Veículos com mais de 20 anos',
 29, 79, NULL, 'monthly');
