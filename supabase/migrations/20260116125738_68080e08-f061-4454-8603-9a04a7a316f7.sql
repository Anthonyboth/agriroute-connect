-- Atualizar o fiscal issuer existente para ambiente de PRODUÇÃO
UPDATE fiscal_issuers 
SET 
  fiscal_environment = 'production',
  updated_at = now()
WHERE id = '0016a4f9-4371-4b00-b215-e6293c7fcb52';

-- Comentário: Este issuer pertence ao perfil 5298f6b3-4ccc-4215-bbea-389ac002e76c (produtor logado)
-- Documento: 93441405617
-- Agora todas as emissões serão enviadas para o ambiente de PRODUÇÃO da Focus NFe