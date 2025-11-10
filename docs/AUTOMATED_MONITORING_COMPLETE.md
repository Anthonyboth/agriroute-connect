# Sistema Completo de Monitoramento Automatizado

## Visão Geral

Sistema abrangente de monitoramento e correção automática implementado para AgriRoute Connect, garantindo segurança, integridade de dados e notificações proativas.

## Componentes Implementados

### 1. Monitoramento de Roles Suspeitas ✅
**Edge Function:** `monitor-suspicious-roles`  
**Cron Job:** A cada hora (0 * * * *)  
**Telegram:** ✅ Ativo

**Funcionalidade:**
- Detecta profiles com roles inválidas
- Identifica conflitos entre `profiles.role` e `user_roles`
- Envia alertas detalhados ao Telegram
- Gera estatísticas de auditoria

---

### 2. Auto-Correção de Roles Inválidas ✅
**Edge Function:** `auto-correct-invalid-roles`  
**Cron Job:** Diariamente às 3h (0 3 * * *)  
**Telegram:** ✅ Ativo

**Funcionalidade:**
- Corrige automaticamente roles inválidas
- Define role como `PRODUTOR` por padrão
- Cria log de auditoria completo em `role_correction_audit`
- Notifica usuário afetado via sistema de notificações
- Envia relatório ao Telegram com correções executadas

**Tabela de Auditoria:**
```sql
CREATE TABLE role_correction_audit (
  id UUID PRIMARY KEY,
  profile_id UUID,
  user_id UUID,
  old_role TEXT,
  new_role TEXT,
  correction_reason TEXT,
  corrected_by TEXT, -- 'SYSTEM' ou admin user_id
  metadata JSONB,
  created_at TIMESTAMP
)
```

---

### 3. Monitoramento de Logins Suspeitos ✅
**Edge Function:** `monitor-suspicious-logins`  
**Cron Job:** A cada hora aos 30min (30 * * * *)  
**Telegram:** ✅ Ativo

**Funcionalidade:**
- Detecta múltiplas falhas de login (≥3 em 1h)
- Identifica acessos de múltiplos IPs (≥3 IPs em 6h)
- Detecta logins em horários incomuns (2h-6h madrugada)
- Utiliza `auth.audit_log_entries` do Supabase
- Envia alertas consolidados ao Telegram

**Funções RPC Implementadas:**
```sql
-- Buscar tentativas de login falhadas
get_failed_login_attempts(since_timestamp, min_failures)

-- Buscar logins com múltiplos IPs
get_multiple_ip_logins(since_timestamp, min_ip_count)

-- Buscar logins em horários incomuns
get_unusual_hour_logins(since_timestamp, start_hour, end_hour)
```

---

### 4. Notificações de Deadline de Entrega ✅
**Edge Function:** `send-delivery-deadline-notifications`  
**Cron Job:** A cada hora (0 * * * *)  
**Sistema:** ✅ Ativo

**Funcionalidade:**
- Verifica fretes com status `DELIVERED_PENDING_CONFIRMATION`
- Calcula tempo restante até deadline de 72h
- Envia notificações ao produtor nos thresholds:
  - **24 horas restantes:** ⏰ Aviso de atenção
  - **6 horas restantes:** 🚨 Aviso urgente
- Previne notificações duplicadas com verificação de threshold

---

### 5. Script de Validação Pós-Migração ✅
**Função RPC:** `validate_roles_post_migration()`

**Execução:**
```sql
SELECT * FROM validate_roles_post_migration();
```

**Retorna:**
- `validation_status`: 'PASSED' ou 'FAILED'
- `invalid_profiles_count`: Quantidade de profiles inválidos
- `invalid_profiles`: JSON com detalhes dos profiles
- `admin_in_user_roles_count`: Quantidade de admins em user_roles
- `recommendations`: Texto com recomendações de ação

**Propósito:**
- Validar que roles administrativos estão apenas em `user_roles`
- Verificar que profiles não contém roles inválidas
- Fornecer relatório pós-migração completo

---

## Configuração de Cron Jobs

Todos os cron jobs foram configurados automaticamente via migration:

```sql
-- Monitoramento de roles (hora em hora)
monitor-suspicious-roles-hourly: 0 * * * *

-- Notificações de deadline (hora em hora)
send-delivery-deadline-notifications-hourly: 0 * * * *

-- Auto-correção de roles (diariamente às 3h)
auto-correct-invalid-roles-daily: 0 3 * * *

-- Monitoramento de logins (hora em hora aos 30min)
monitor-suspicious-logins-hourly: 30 * * * *
```

---

## Integração com Telegram

**Bot Token:** Configurado em `TELEGRAM_BOT_TOKEN` (secret)  
**Chat ID:** `-1003009756749` (Grupo de monitoramento)

### Tipos de Alertas

#### 🚨 Crítico
- Roles suspeitas detectadas
- Auto-correção executada
- Múltiplas falhas de login (≥3 em 1h)
- Erros críticos do sistema de monitoramento

#### ⚠️ Informativo
- Conflitos de permissões administrativas (auditoria)
- Múltiplos IPs para mesmo usuário
- Logins em horários incomuns

#### ✅ Regular
- Resumo de monitoramento (confirma sistema ativo)
- Estatísticas de execução dos cron jobs

---

## Segurança e Auditoria

### Proteções Implementadas

1. **RLS (Row Level Security)**
   - `role_correction_audit` protegida por RLS
   - Admins podem visualizar todos os logs
   - Sistema pode inserir correções automaticamente

2. **Funções SECURITY DEFINER**
   - Todas as funções RPC usam `SECURITY DEFINER`
   - `SET search_path = public` para prevenir SQL injection
   - Acesso controlado a `auth.audit_log_entries`

3. **Rate Limiting Implícito**
   - Cron jobs executam em intervalos fixos
   - Previne sobrecarga do sistema
   - Notificações agrupadas quando possível

### Logs de Auditoria

Todas as ações são registradas em:
- `role_correction_audit`: Correções de roles
- `audit_logs`: Ações administrativas
- Edge Function logs: Execuções e erros

---

## Testando o Sistema

### Teste Manual de Edge Functions

```bash
# Testar monitoramento de roles
curl -X POST https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-suspicious-roles \
  -H "Content-Type: application/json" \
  -d '{"time": "2025-11-10T12:00:00Z"}'

# Testar auto-correção
curl -X POST https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/auto-correct-invalid-roles \
  -H "Content-Type: application/json" \
  -d '{"time": "2025-11-10T12:00:00Z"}'

# Testar monitoramento de logins
curl -X POST https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/monitor-suspicious-logins \
  -H "Content-Type: application/json" \
  -d '{"time": "2025-11-10T12:00:00Z"}'

# Testar notificações de deadline
curl -X POST https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/send-delivery-deadline-notifications \
  -H "Content-Type: application/json" \
  -d '{"time": "2025-11-10T12:00:00Z"}'
```

### Validação Pós-Migração

```sql
-- Executar validação
SELECT * FROM validate_roles_post_migration();

-- Verificar logs de auditoria
SELECT * FROM role_correction_audit ORDER BY created_at DESC LIMIT 10;

-- Verificar cron jobs ativos
SELECT * FROM cron.job 
WHERE jobname LIKE '%monitor%' 
   OR jobname LIKE '%auto-correct%' 
   OR jobname LIKE '%deadline%'
   OR jobname LIKE '%login%';
```

### Simular Scenarios de Teste

**⚠️ NÃO EXECUTAR EM PRODUÇÃO!**

```sql
-- Criar profile com role inválida
INSERT INTO profiles (user_id, email, role)
VALUES (auth.uid(), 'teste@example.com', 'INVALID_ROLE');

-- Verificar se auto-correção detecta (aguardar próxima execução ou rodar manualmente)
```

---

## Verificando Execução dos Cron Jobs

```sql
-- Ver jobs agendados
SELECT * FROM cron.job 
WHERE jobname IN (
  'monitor-suspicious-roles-hourly',
  'send-delivery-deadline-notifications-hourly',
  'auto-correct-invalid-roles-daily',
  'monitor-suspicious-logins-hourly'
);

-- Ver histórico de execuções
SELECT 
  j.jobname,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON jrd.jobid = j.jobid
WHERE j.jobname IN (
  'monitor-suspicious-roles-hourly',
  'send-delivery-deadline-notifications-hourly',
  'auto-correct-invalid-roles-daily',
  'monitor-suspicious-logins-hourly'
)
ORDER BY jrd.start_time DESC
LIMIT 20;
```

---

## Manutenção e Troubleshooting

### Logs das Edge Functions

Acesse o Supabase Dashboard:
1. **Edge Functions** → Selecionar função
2. **Logs** → Visualizar execuções recentes
3. Filtrar por erros ou sucessos

### Problemas Comuns

**1. Mensagens não chegam no Telegram**
- Verificar `TELEGRAM_BOT_TOKEN` configurado
- Confirmar bot adicionado ao grupo com Chat ID correto
- Verificar logs da edge function para erros de API

**2. Cron jobs não executam**
- Confirmar `pg_cron` e `pg_net` habilitados
- Verificar `cron.job_run_details` para erros
- Checar se Project ID e Anon Key estão corretos

**3. Auto-correção não funciona**
- Verificar se há profiles com roles inválidas
- Checar RLS policies da tabela `role_correction_audit`
- Ver logs da edge function para detalhes

**4. Muitos alertas de logins falsos positivos**
- Ajustar thresholds nas funções RPC
- Revisar lógica de detecção de horários incomuns
- Considerar whitelist de IPs confiáveis

---

## Próximos Passos Sugeridos

1. **Dashboard Web de Monitoramento**
   - Interface para visualizar histórico de alertas
   - Gráficos de tendências e estatísticas
   - Gerenciamento de thresholds e configurações

2. **Sistema de Whitelist**
   - Permitir marcar IPs/usuários confiáveis
   - Evitar falsos positivos em casos legítimos
   - Configuração por admin via interface

3. **Notificações por Severidade**
   - Canais Telegram diferentes por nível
   - Escalação de alertas críticos
   - Resumos diários/semanais

4. **Métricas Históricas**
   - Salvar estatísticas em tabela dedicated
   - Análise temporal de segurança
   - Relatórios automatizados

5. **Rotação de Chaves de Criptografia**
   - Implementar sistema de rotação automática
   - Migração gradual de documentos
   - Criptografia real em vez de obfuscação

6. **Alertas de Inatividade**
   - Notificar se sistema não executar por 2+ horas
   - Healthcheck endpoint para monitoramento externo
   - Dead man's switch para garantir funcionamento

---

## Documentação Adicional

- **Monitoramento de Roles:** [SECURITY_MONITORING.md](./SECURITY_MONITORING.md)
- **Hardening de Segurança:** [SECURITY_DOCUMENTATION.md](./SECURITY_DOCUMENTATION.md)
- **Monitoramento de Erros:** [ERROR_MONITORING_SETUP.md](./ERROR_MONITORING_SETUP.md)

---

## Resumo de Implementação

✅ **4 Edge Functions criadas**  
✅ **4 Cron Jobs configurados**  
✅ **1 Tabela de auditoria criada**  
✅ **4 Funções RPC implementadas**  
✅ **Integração completa com Telegram**  
✅ **Script de validação pós-migração**  
✅ **Documentação completa**

**Status:** Sistema 100% funcional e automatizado! 🎉
