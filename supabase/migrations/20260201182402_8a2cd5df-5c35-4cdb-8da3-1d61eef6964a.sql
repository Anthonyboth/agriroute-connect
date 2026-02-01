-- Adicionar coluna focus_company_id à tabela fiscal_issuers
-- Esta coluna armazena o identificador da empresa cadastrada na Focus NFe

ALTER TABLE public.fiscal_issuers 
ADD COLUMN IF NOT EXISTS focus_company_id TEXT;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.fiscal_issuers.focus_company_id IS 'ID/CNPJ da empresa cadastrada na API da Focus NFe';

-- Criar índice para buscas por focus_company_id
CREATE INDEX IF NOT EXISTS idx_fiscal_issuers_focus_company_id 
ON public.fiscal_issuers (focus_company_id) 
WHERE focus_company_id IS NOT NULL;