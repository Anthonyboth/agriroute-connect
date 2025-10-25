-- Adicionar índice único em ibge_code para garantir importações idempotentes
-- e índices para otimizar buscas de cidades

-- Criar índice único em ibge_code (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS cities_ibge_code_unique_idx 
ON public.cities (ibge_code);

-- Criar índice composto para buscas por estado e nome (se não existir)
CREATE INDEX IF NOT EXISTS cities_state_name_idx 
ON public.cities (state, name);

-- Comentário: O índice trigram para busca de texto foi removido pois
-- a extensão pg_trgm pode não estar habilitada em todos os ambientes