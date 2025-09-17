-- Adicionar status CANCELLED para freight_proposals
-- Como é um campo text sem restrições rígidas, podemos simplesmente 
-- documentar que CANCELLED é um status válido
-- Vamos verificar se existem restrições CHECK e tentar remover/recriar

-- First check the current column type
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'freight_proposals' AND column_name = 'status';

-- Add comment to document valid statuses
COMMENT ON COLUMN public.freight_proposals.status IS 'Valid statuses: PENDING, ACCEPTED, REJECTED, CANCELLED';