-- Atualizar coordenadas de Canarana (MT) que está faltando no banco
UPDATE public.cities 
SET lat = -13.5514, lng = -52.2697
WHERE LOWER(name) = 'canarana' AND state = 'MT';

-- Remover cidade com nome inválido (era uma coordenada usada como nome)
DELETE FROM public.cities WHERE name = '-15.568862';

-- Garantir que outras cidades comuns de MT tenham coordenadas
UPDATE public.cities 
SET lat = -15.5561, lng = -54.2958
WHERE LOWER(name) = 'primavera do leste' AND state = 'MT' AND (lat IS NULL OR lng IS NULL);

-- Atualizar Sinop se estiver sem coords
UPDATE public.cities 
SET lat = -11.8608, lng = -55.5094
WHERE LOWER(name) = 'sinop' AND state = 'MT' AND (lat IS NULL OR lng IS NULL);

-- Atualizar Sorriso se estiver sem coords
UPDATE public.cities 
SET lat = -12.5423, lng = -55.7212
WHERE LOWER(name) = 'sorriso' AND state = 'MT' AND (lat IS NULL OR lng IS NULL);

-- Atualizar Cuiabá se estiver sem coords
UPDATE public.cities 
SET lat = -15.6014, lng = -56.0979
WHERE LOWER(name) LIKE 'cuiab%' AND state = 'MT' AND (lat IS NULL OR lng IS NULL);

-- Atualizar Campo Grande (MS) se estiver sem coords
UPDATE public.cities 
SET lat = -20.4697, lng = -54.6201
WHERE LOWER(name) = 'campo grande' AND state = 'MS' AND (lat IS NULL OR lng IS NULL);

-- Atualizar Rondonópolis se estiver sem coords
UPDATE public.cities 
SET lat = -16.4673, lng = -54.6372
WHERE LOWER(name) LIKE 'rondon%polis' AND state = 'MT' AND (lat IS NULL OR lng IS NULL);