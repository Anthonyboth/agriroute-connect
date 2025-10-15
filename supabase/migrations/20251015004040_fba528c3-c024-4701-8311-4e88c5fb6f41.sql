-- Remover índice antigo que bloqueia completamente documentos duplicados
DROP INDEX IF EXISTS idx_profiles_document_unique;

-- Garantir que o índice correto existe (permite múltiplos perfis de roles diferentes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_document_role 
ON profiles(document, role) 
WHERE document IS NOT NULL 
  AND role IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA');