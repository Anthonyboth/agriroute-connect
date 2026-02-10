-- Limpar match_exposures de teste
DELETE FROM match_exposures WHERE item_id::text LIKE 'f0000001-%' OR item_id::text LIKE 'a0000001-%';

-- Limpar freight_assignments de teste
DELETE FROM freight_assignments WHERE freight_id::text LIKE 'f0000001-%';

-- Limpar fretes de teste
DELETE FROM freights WHERE id::text LIKE 'f0000001-%';

-- Limpar service_requests de teste
DELETE FROM service_requests WHERE id::text LIKE 'a0000001-%';