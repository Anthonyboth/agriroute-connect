-- Primeiro, vamos ver quais status existem na tabela
-- E depois deletar todos os fretes que não estão finalizados
DELETE FROM public.freights 
WHERE status NOT IN ('DELIVERED', 'CANCELLED');

-- Excluir todos os perfis
DELETE FROM public.profiles;