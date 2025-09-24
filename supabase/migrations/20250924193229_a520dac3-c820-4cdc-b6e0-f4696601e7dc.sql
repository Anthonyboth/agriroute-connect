-- Remover valores das solicitações de serviços pendentes
UPDATE service_requests 
SET estimated_price = NULL 
WHERE status = 'OPEN' AND location_address ILIKE '%Primavera do Leste%';