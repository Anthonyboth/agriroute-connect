-- Atualizar "Palavras da Salvação" para type='success' e priority=100
UPDATE system_announcements 
SET type = 'success', priority = 100, updated_at = now()
WHERE title = 'Palavras da Salvação' AND is_active = true;

-- Ajustar priority do outro anúncio para 90
UPDATE system_announcements 
SET priority = 90, updated_at = now()
WHERE title = 'Período de Testes - Plataforma Gratuita' AND is_active = true;