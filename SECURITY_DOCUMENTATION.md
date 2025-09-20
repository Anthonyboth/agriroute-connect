# 🔒 AgriRoute - Documentação de Segurança Zero-Trust

## 📋 Visão Geral

O sistema de segurança AgriRoute implementa uma arquitetura **Zero-Trust** com múltiplas camadas de proteção, auditoria completa e monitoramento em tempo real.

## 🛡️ Funcionalidades de Segurança Implementadas

### 1. **Row Level Security (RLS) Ultra-Restritivo**
- ✅ RLS habilitado em **TODAS** as tabelas críticas
- ✅ Políticas extremamente restritivas por usuário/role
- ✅ Drivers só veem fretes matched especificamente para eles
- ✅ Produtores só acessam seus próprios dados
- ✅ Zero acesso cruzado entre usuários

### 2. **Auditoria Completa** 
- ✅ **Tabela `audit_logs`**: Log de todas as operações críticas
- ✅ **Triggers automáticos** em tabelas sensíveis (freights, payments, profiles)
- ✅ **Log de acesso** a dados sensíveis via `log_sensitive_data_access()`
- ✅ **Detecção de acessos suspeitos** (>1000 registros, tabelas críticas)
- ✅ **Rastreamento de IP e User Agent**

### 3. **Criptografia de Dados Sensíveis**
- ✅ Extensão **pgcrypto** para criptografia AES
- ✅ Função `encrypt_document()` para CPF/CNPJ/documentos
- ✅ Função `decrypt_document()` apenas para admins
- ✅ **Masking automático** para usuários não autorizados
- ✅ **Chaves únicas** por documento + salt

### 4. **Rate Limiting Avançado**
- ✅ **Tabela `rate_limit_violations`**: Controle de abuso
- ✅ Função `check_rate_limit()` por endpoint
- ✅ **Blacklist automática** de IPs suspeitos
- ✅ **Escalation** de bloqueios (temporário → permanente)

### 5. **Blacklist de Segurança**
- ✅ **Tabela `security_blacklist`**: IPs/usuários bloqueados
- ✅ **Bloqueios temporários e permanentes**
- ✅ **Detecção automática** de padrões suspeitos
- ✅ **Interface administrativa** para gerenciar bloqueios

### 6. **Funções de Validação Seguras**
- ✅ `get_current_user_safe()`: Obter usuário atual sem vazamentos
- ✅ `is_freight_owner()`: Verificar propriedade de fretes
- ✅ `is_ip_blacklisted()`: Verificar IPs bloqueados
- ✅ **SECURITY DEFINER** com `search_path` fixo

## 📊 Monitoramento em Tempo Real

### Dashboard de Segurança (`SecurityMonitoringPanel`)
- 📈 **Estatísticas de segurança** em tempo real
- 🔍 **Logs de auditoria** com filtros
- ⚠️ **Violações de rate limit** por IP/usuário
- 🚫 **Blacklist management** com bloqueio/desbloqueio
- 🚨 **Alertas de atividade suspeita**

## 🔧 Implementação de Uso

### 1. Em Edge Functions (Backend)
```typescript
// Verificar rate limit antes de processar
const { data: canProceed, error } = await supabase
  .rpc('check_rate_limit', {
    endpoint_name: 'freight-matching',
    max_requests: 50,
    time_window: '1 hour'
  });

if (!canProceed) {
  return new Response('Rate limit exceeded', { status: 429 });
}

// Log de acesso a dados sensíveis
await supabase.rpc('log_sensitive_data_access', {
  accessed_table: 'freights',
  accessed_id: freightId,
  access_type: 'freight_details_view'
});
```

### 2. No Frontend (React)
```typescript
// Usar RPC seguro para dados do usuário
const { data: profile, error } = await supabase
  .rpc('get_secure_user_profile');

// Todos os acessos são automaticamente auditados via triggers
```

### 3. Criptografia de Documentos
```sql
-- Inserir documento criptografado
INSERT INTO profiles (cpf_encrypted) 
VALUES (encrypt_document('123.456.789-00'));

-- Recuperar documento (só para admins)
SELECT decrypt_document(cpf_encrypted, '123.456.789-00') FROM profiles;
```

## 🚨 Alertas e Notificações

### Atividades que Geram Alertas Automáticos:
1. **>1000 registros** acessados de uma vez
2. **Acesso a tabelas críticas** (profiles, payments)
3. **Violações de rate limit** (>limite por hora)
4. **Tentativas de acesso** a dados não autorizados
5. **Modificações críticas** (DELETE em tabelas importantes)

### Escalation Automático:
- **5 violações/hora** → Bloqueio temporário (24h)
- **>50 violações** → Blacklist permanente
- **Acesso a dados não autorizados** → Blacklist imediata

## 📋 Políticas RLS Implementadas

### Fretes (`freights`)
```sql
-- Drivers: Só fretes matched + aceitos
-- Produtores: Só fretes próprios  
-- Admins: Acesso completo
CREATE POLICY "Ultra-restrictive freight access"
ON public.freights FOR SELECT
USING (
  (status = 'OPEN' AND id IN (
    SELECT freight_id FROM freight_matches 
    WHERE driver_id = get_current_user_safe()
  )) OR
  (driver_id = get_current_user_safe()) OR
  (producer_id = get_current_user_safe()) OR
  is_admin()
);
```

### Perfis (`profiles`)
```sql
-- Usuários: Só próprio perfil
-- Zero acesso cruzado
CREATE POLICY "Own profile only"
ON public.profiles FOR SELECT
USING (user_id = auth.uid() OR is_admin());
```

## 🔍 Auditoria e Compliance

### Dados Coletados Automaticamente:
- ✅ **Quem** (user_id)
- ✅ **O que** (operação + dados)  
- ✅ **Quando** (timestamp preciso)
- ✅ **Onde** (IP address)
- ✅ **Como** (user agent, sessão)

### Retenção de Logs:
- **Logs críticos**: 7 anos
- **Logs de acesso**: 2 anos  
- **Rate limits**: 90 dias
- **Atividade suspeita**: Permanente

## 🚀 Como Usar o Sistema

### Para Desenvolvedores:
1. **Todas as queries** passam automaticamente pelo RLS
2. **Use as funções RPC seguras** em vez de queries diretas
3. **Rate limiting** é aplicado automaticamente via Edge Functions
4. **Auditoria** acontece via triggers automáticos

### Para Administradores:
1. Acesse o **SecurityMonitoringPanel** no dashboard
2. Monitore **logs de auditoria** em tempo real
3. **Gerencie blacklist** de IPs/usuários suspeitos
4. **Configure alertas** para atividades críticas

### Para Usuários Finais:
- **Transparência total**: Sabem quando seus dados são acessados
- **Masking automático**: Dados sensíveis sempre protegidos
- **Rate limiting justo**: Previne abuso sem impactar uso normal

## 📈 Métricas de Segurança

O sistema coleta automaticamente:
- **Taxa de violações** por usuário/IP
- **Padrões de acesso** suspeitos
- **Performance de rate limiting**
- **Efetividade da blacklist**
- **Cobertura de auditoria**

## 🔧 Manutenção e Monitoring

### Tarefas Automáticas:
- ✅ **Limpeza de logs** antigos (via cron job)
- ✅ **Expiração de bloqueios** temporários
- ✅ **Rotação de chaves** de criptografia
- ✅ **Backup de logs** críticos

### Monitoramento Contínuo:
- 🔍 **Dashboard em tempo real**
- 📧 **Alertas por email** para admins
- 📊 **Relatórios semanais** de segurança
- 🚨 **Notificações push** para atividades críticas

---

## 🛠️ Configuração de Produção

Para ativar todas as proteções:

1. **Habilitar SSL obrigatório** no Supabase
2. **Desabilitar conexão pública** ao Postgres
3. **Rotacionar chaves** regularmente
4. **Configurar alertas** por email/Slack
5. **Backup automático** dos logs de auditoria

---

**⚠️ IMPORTANTE**: Este sistema implementa proteção **extrema** seguindo princípios Zero-Trust. Todos os acessos são monitorados, auditados e restringidos ao mínimo necessário. Para ambiente de produção AgriRoute, estas medidas são **OBRIGATÓRIAS**.