-- Adicionar tipos específicos de Rodotrens
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'RODOTREM_7_EIXOS';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'RODOTREM_9_EIXOS';

-- Adicionar tipos específicos de Bitrens
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'BITREM_7_EIXOS';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'BITREM_9_EIXOS';

-- Adicionar Tritrens
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'TRITREM_9_EIXOS';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'TRITREM_11_EIXOS';

-- Adicionar Cavalo Mecânico
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CAVALO_MECANICO_TOCO';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CAVALO_MECANICO_TRUCK';

-- Adicionar tipos específicos de Carretas
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_SIDER';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_GRANELEIRA';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_PRANCHA';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_TANQUE';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_FRIGORIFICA';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_3_EIXOS';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_2_EIXOS';

-- Adicionar tipos de Caminhões
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CAMINHAO_3_4';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CAMINHAO_TRUCK';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CAMINHONETE';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'VLC_URBANO';
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'PICKUP';

-- Adicionar categoria genérica OUTROS (importante!)
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'OUTROS';

COMMENT ON TYPE vehicle_type IS 'Tipos de veículos para transporte rodoviário de cargas. Inclui categoria OUTROS para tipos não especificados.';