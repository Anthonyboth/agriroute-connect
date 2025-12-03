# Plano de Migração para Criptografia de Documentos

**Data:** 02/12/2025  
**Versão:** 1.0  
**Status:** Planejamento  
**AgriRoute Connect**

---

## 1. Estado Atual

### Documentos Armazenados
- CNH de motoristas (imagens)
- RNTRC (registro ANTT)
- Comprovantes de propriedade de veículos
- Documentos fiscais (MDF-e, CT-e)
- Comprovantes de pagamento

### Armazenamento Atual
- **Local:** Supabase Storage (bucket `documents`)
- **Criptografia:** TLS em trânsito, criptografia at-rest do Supabase
- **Controle de Acesso:** RLS policies + URLs assinadas temporárias

### Riscos Identificados
1. Acesso direto ao bucket por usuários autenticados
2. URLs assinadas podem ser compartilhadas
3. Sem criptografia adicional além do Supabase padrão

---

## 2. Opções de Implementação

### Opção A: Supabase Vault (Recomendado)

**Descrição:** Usar o Supabase Vault para gerenciar chaves de criptografia

**Vantagens:**
- Integração nativa com Supabase
- Sem infraestrutura adicional
- Gerenciamento de chaves automatizado
- Rotação de chaves suportada

**Implementação:**
```sql
-- Habilitar extensão
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Criar chave para documentos
SELECT vault.create_secret(
  'document_encryption_key',
  'Chave para criptografia de documentos'
);
```

**Custo:** Incluído no plano Supabase Pro

---

### Opção B: AWS KMS

**Descrição:** Usar AWS Key Management Service

**Vantagens:**
- Padrão enterprise
- Auditoria detalhada (CloudTrail)
- Compliance (SOC, HIPAA, PCI)

**Desvantagens:**
- Custo adicional (~$1/chave/mês + $0.03/10k requests)
- Complexidade de integração
- Latência adicional

---

### Opção C: Criptografia Client-Side

**Descrição:** Criptografar no frontend antes do upload

**Vantagens:**
- Zero-knowledge (servidor nunca vê dados em claro)
- Máxima privacidade

**Desvantagens:**
- Complexidade de gerenciamento de chaves
- Impossibilita busca/indexação
- Risco de perda de dados se chave perdida

---

## 3. Decisão: Supabase Vault

Recomendamos a **Opção A (Supabase Vault)** pelos seguintes motivos:

1. Já utilizamos Supabase - integração simplificada
2. Custo incluído no plano atual
3. Conformidade adequada para LGPD
4. Complexidade gerenciável

---

## 4. Estratégia de Migração

### Fase 1: Preparação (Semana 1)
- [ ] Habilitar extensão pgsodium
- [ ] Criar chaves de criptografia no Vault
- [ ] Criar tabela de metadados criptografados
- [ ] Backup completo do bucket atual

### Fase 2: Implementação (Semana 2)
- [ ] Criar funções de encrypt/decrypt no banco
- [ ] Modificar upload de documentos para criptografar
- [ ] Modificar download para descriptografar
- [ ] Testes em ambiente de staging

### Fase 3: Migração de Dados (Semana 3)
- [ ] Script de migração para documentos existentes
- [ ] Verificação de integridade
- [ ] Rollback preparado

### Fase 4: Validação (Semana 4)
- [ ] Testes de segurança
- [ ] Testes de performance
- [ ] Documentação atualizada
- [ ] Go-live

---

## 5. Schema do Banco

```sql
-- Tabela de metadados de documentos criptografados
CREATE TABLE encrypted_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  encryption_key_id UUID NOT NULL,
  encrypted_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID REFERENCES profiles(id),
  document_type TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE encrypted_documents ENABLE ROW LEVEL SECURITY;

-- Policy: usuário vê apenas seus documentos
CREATE POLICY "Users see own documents"
ON encrypted_documents FOR SELECT
USING (owner_id = auth.uid());
```

---

## 6. Funções de Criptografia

```sql
-- Função para criptografar documento
CREATE OR REPLACE FUNCTION encrypt_document(
  p_data BYTEA,
  p_key_id UUID
) RETURNS BYTEA AS $$
DECLARE
  v_key BYTEA;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE id = p_key_id;
  
  RETURN pgsodium.crypto_secretbox(p_data, pgsodium.crypto_secretbox_nonce(), v_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para descriptografar documento
CREATE OR REPLACE FUNCTION decrypt_document(
  p_encrypted BYTEA,
  p_key_id UUID,
  p_nonce BYTEA
) RETURNS BYTEA AS $$
DECLARE
  v_key BYTEA;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE id = p_key_id;
  
  RETURN pgsodium.crypto_secretbox_open(p_encrypted, p_nonce, v_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. Backup Strategy

### Antes da Migração
1. Snapshot completo do banco de dados
2. Cópia do bucket de documentos para bucket de backup
3. Export das chaves de criptografia (offline, seguro)

### Durante a Migração
1. Log detalhado de cada documento migrado
2. Checksum antes/depois para verificação
3. Capacidade de rollback a qualquer momento

### Após a Migração
1. Manter backup por 30 dias
2. Verificação semanal de integridade
3. Teste mensal de restore

---

## 8. Testes em Staging

### Checklist de Testes
- [ ] Upload de novo documento criptografado
- [ ] Download e verificação de integridade
- [ ] Migração de documento existente
- [ ] Performance (latência < 500ms adicional)
- [ ] Erro de chave inválida
- [ ] Erro de documento corrompido
- [ ] Rotação de chave
- [ ] Rollback de migração

### Ambiente de Staging
- URL: staging.agriroute.com.br
- Banco: Supabase projeto separado
- Dados: Anonimizados de produção

---

## 9. Rollback Plan

### Gatilhos de Rollback
- Perda de mais de 1% dos documentos
- Latência > 2s no download
- Erros de descriptografia > 0.1%

### Procedimento de Rollback
1. Pausar uploads novos
2. Restaurar bucket de backup
3. Reverter schema do banco
4. Notificar usuários afetados
5. Investigar causa raiz

---

## 10. Timeline

| Semana | Atividade | Responsável |
|--------|-----------|-------------|
| 1 | Preparação e backup | DevOps |
| 2 | Implementação em staging | Backend |
| 3 | Testes e validação | QA |
| 4 | Migração de produção | DevOps + Backend |
| 5 | Monitoramento pós-migração | Todos |

---

## 11. Métricas de Sucesso

- 100% dos documentos migrados com sucesso
- Zero perda de dados
- Latência de download < 1s (atual + 500ms)
- Zero incidentes de segurança
- Compliance LGPD verificado

---

*Este plano será executado após aprovação da equipe técnica e validação em ambiente de staging.*
