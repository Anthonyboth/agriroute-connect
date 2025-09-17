-- Tornar o campo CPF/CNPJ obrigatório na tabela profiles
-- Primeiro vamos verificar se existem registros sem CPF/CNPJ e atualizá-los
UPDATE profiles 
SET cpf_cnpj = '000.000.000-00' 
WHERE cpf_cnpj IS NULL OR cpf_cnpj = '';

-- Agora tornar o campo obrigatório
ALTER TABLE profiles 
ALTER COLUMN cpf_cnpj SET NOT NULL;

-- Adicionar uma constraint para garantir que o campo não seja vazio
ALTER TABLE profiles 
ADD CONSTRAINT cpf_cnpj_not_empty 
CHECK (cpf_cnpj IS NOT NULL AND trim(cpf_cnpj) != '');

-- Comentário explicativo
COMMENT ON COLUMN profiles.cpf_cnpj IS 'CPF ou CNPJ obrigatório para todos os usuários cadastrados';