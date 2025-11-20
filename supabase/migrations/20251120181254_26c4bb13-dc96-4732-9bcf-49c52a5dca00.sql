-- ========================================
-- ADICIONAR TIPOS DE VEÍCULOS FALTANTES AO ENUM
-- ========================================
-- Este script adiciona os tipos de veículos especializados que
-- estavam definidos no frontend mas faltavam no banco de dados

-- Adicionar CARRETA_GADO (Carreta Boiadeira para transporte de gado)
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_GADO';

-- Adicionar CARRETA_REFRIGERADA (Carreta Refrigerada para perecíveis)
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'CARRETA_REFRIGERADA';

-- Adicionar PRANCHA (Prancha para transporte de máquinas)
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'PRANCHA';

-- Atualizar comentário do tipo para refletir todos os valores
COMMENT ON TYPE vehicle_type IS 'Tipos de veículos disponíveis no sistema: VUC, TOCO, TRUCK, CARRETA, BI_TRUCK, CARRETA_GADO, CARRETA_REFRIGERADA, PRANCHA, BITREM, RODOTREM';