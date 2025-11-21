-- Reordenar avisos do mural: diesel deve aparecer por último
-- Palavras da Salvação (priority 100) - primeiro
-- Período de Testes (priority 90) - segundo  
-- Sistema Diesel (priority 80) - último

UPDATE system_announcements
SET priority = 80
WHERE id = '3bf29a08-13e5-4020-b1b9-6fa3f892def1'
AND title = '⛽ O Sistema de Mensalidade Será Baseado no Diesel';