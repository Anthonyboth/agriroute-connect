# Guia de Monitoramento de Segurança

**Data:** 02/12/2025  
**AgriRoute Connect**

Este guia explica como interpretar os dashboards, métricas e alertas do sistema de monitoramento de segurança.

---

## 1. Dashboards Disponíveis

### 1.1 Advanced Security Dashboard
**Localização:** `/admin/security` (apenas admins)

**Métricas exibidas:**
- Health Score (0-100)
- Erros críticos últimas 24h/7d/30d
- Tentativas de login falhadas
- Violações de rate limit
- IPs bloqueados ativos
- Uptime do sistema

**Como interpretar:**
| Health Score | Status | Ação |
|--------------|--------|------|
| 90-100 | 🟢 Excelente | Monitorar normalmente |
| 70-89 | 🟡 Atenção | Investigar warnings |
| 50-69 | 🟠 Alerta | Ação necessária |
| 0-49 | 🔴 Crítico | Ação imediata |

### 1.2 Supabase Dashboard
**Localização:** https://supabase.com/dashboard

**Seções importantes:**
- **Logs → Postgres:** Erros de banco
- **Logs → Edge Functions:** Erros de funções
- **Auth → Users:** Atividade de usuários
- **Database → Replication:** Health do banco

---

## 2. Alertas Telegram

### 2.1 Tipos de Alertas

#### 🚨 CRÍTICO
```
🚨 ALERTA CRÍTICO - AgriRoute

Tipo: SECURITY_VIOLATION
Mensagem: Tentativa de escalação de privilégios
Usuário: user@example.com
IP: 192.168.1.1

Ação imediata necessária!
```
**Resposta:** Investigar em até 15 minutos

#### ⚠️ WARNING
```
⚠️ ALERTA - AgriRoute

Tipo: RATE_LIMIT_EXCEEDED
IP: 192.168.1.1
Endpoint: /api/login
Tentativas: 15 em 5 minutos

Monitorando...
```
**Resposta:** Verificar em até 1 hora

#### ℹ️ INFO
```
ℹ️ INFO - AgriRoute

Relatório diário de segurança
Health Score: 95/100
Erros 24h: 3
Logins falhados: 12

Sistema operando normalmente.
```
**Resposta:** Apenas registro

### 2.2 Silenciar Alertas

Para silenciar alertas temporariamente durante manutenção:
1. Envie `/mute 30` ao bot (silencia por 30 min)
2. Ou desative o cron job temporariamente

---

## 3. Métricas e Thresholds

### 3.1 Thresholds Padrão

| Métrica | Warning | Crítico |
|---------|---------|---------|
| Logins falhados/hora | > 10 | > 50 |
| Erros 500/hora | > 5 | > 20 |
| Rate limit violations/hora | > 20 | > 100 |
| Tempo resposta médio | > 2s | > 5s |
| CPU Edge Functions | > 70% | > 90% |

### 3.2 Ajustando Thresholds

No `AdvancedSecurityDashboard.tsx`:
```typescript
const THRESHOLDS = {
  failedLogins: { warning: 10, critical: 50 },
  errors500: { warning: 5, critical: 20 },
  rateLimitViolations: { warning: 20, critical: 100 },
};
```

---

## 4. Logs e Auditoria

### 4.1 Tabela audit_logs

**Campos importantes:**
- `operation`: INSERT, UPDATE, DELETE
- `table_name`: Tabela afetada
- `user_id`: Quem fez a ação
- `old_data`: Dados antes
- `new_data`: Dados depois
- `ip_address`: IP do usuário

**Queries úteis:**
```sql
-- Últimas ações de um usuário
SELECT * FROM audit_logs 
WHERE user_id = 'uuid-do-usuario'
ORDER BY timestamp DESC 
LIMIT 50;

-- Todas as exclusões hoje
SELECT * FROM audit_logs
WHERE operation = 'DELETE'
AND timestamp > NOW() - INTERVAL '24 hours';

-- Ações suspeitas (muitas em pouco tempo)
SELECT user_id, COUNT(*) as actions
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 100;
```

### 4.2 Tabela error_logs

**Campos importantes:**
- `error_type`: FRONTEND, BACKEND, DATABASE
- `error_category`: SIMPLE, CRITICAL
- `error_message`: Descrição
- `status`: NEW, RESOLVED, NOTIFIED

**Queries úteis:**
```sql
-- Erros críticos não resolvidos
SELECT * FROM error_logs
WHERE error_category = 'CRITICAL'
AND status != 'RESOLVED'
ORDER BY created_at DESC;

-- Erros mais frequentes
SELECT error_message, COUNT(*) as count
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY count DESC
LIMIT 10;
```

---

## 5. Cron Jobs de Segurança

### 5.1 Jobs Configurados

| Job | Frequência | Função |
|-----|------------|--------|
| `security-hourly-monitor` | Cada hora | Monitor contínuo |
| `security-daily-report-8am` | Diário 8h | Relatório Telegram |
| `suspicious-logins-30min` | Cada 30min | Detectar logins suspeitos |
| `cleanup-old-logs-weekly` | Domingo 3h | Limpar logs antigos |

### 5.2 Verificar Status dos Crons

```sql
-- Listar crons ativos
SELECT * FROM cron.job;

-- Ver execuções recentes
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Verificar erros em crons
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
```

### 5.3 Pausar/Retomar Crons

```sql
-- Pausar um cron
SELECT cron.unschedule('security-hourly-monitor');

-- Retomar
SELECT cron.schedule(
  'security-hourly-monitor',
  '0 * * * *',
  $$SELECT net.http_post(...)$$
);
```

---

## 6. Respondendo a Incidentes

### 6.1 Playbook: Login Brute Force

**Detecção:** > 10 logins falhados do mesmo IP em 15min

**Resposta:**
1. Verificar se IP é legítimo (VPN corporativa?)
2. Se suspeito, adicionar à blacklist:
```sql
INSERT INTO security_blacklist (ip_address, reason, blocked_until)
VALUES ('192.168.1.1', 'Brute force attempt', NOW() + INTERVAL '24 hours');
```
3. Notificar usuário alvo se conta real
4. Documentar incidente

### 6.2 Playbook: Erro Crítico em Produção

**Detecção:** error_category = 'CRITICAL'

**Resposta:**
1. Verificar impacto (quantos usuários afetados?)
2. Se generalizado, ativar página de manutenção
3. Investigar logs:
```sql
SELECT * FROM error_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
AND error_category = 'CRITICAL'
ORDER BY created_at DESC;
```
4. Corrigir e testar
5. Marcar como resolvido:
```sql
UPDATE error_logs SET status = 'RESOLVED' WHERE id = 'uuid';
```

### 6.3 Playbook: Vazamento de Dados Suspeito

**Detecção:** Download massivo ou acesso anômalo

**Resposta:**
1. **IMEDIATAMENTE:** Revogar sessões do usuário suspeito
```sql
DELETE FROM auth.sessions WHERE user_id = 'uuid';
```
2. Bloquear conta temporariamente
3. Coletar evidências (logs, audit trail)
4. Notificar DPO
5. Se confirmado vazamento, seguir processo LGPD

---

## 7. Manutenção Preventiva

### 7.1 Checklist Diário
- [ ] Verificar alertas Telegram pendentes
- [ ] Revisar health score no dashboard
- [ ] Verificar erros críticos não resolvidos

### 7.2 Checklist Semanal
- [ ] Revisar audit_logs para anomalias
- [ ] Verificar execução dos cron jobs
- [ ] Atualizar dependências com vulnerabilidades
- [ ] Backup manual de configs críticas

### 7.3 Checklist Mensal
- [ ] Revisar e rotacionar API keys
- [ ] Auditar acessos de usuários admin
- [ ] Gerar relatório de tendências
- [ ] Testar restore de backup

---

## 8. Contatos de Suporte

| Situação | Contato |
|----------|---------|
| Dúvidas operacionais | agrirouteconnect@gmail.com |
| Incidente de segurança | WhatsApp +55 15 66 9 9942-6656 |
| Bug em produção | GitHub Issues |

---

## 9. Glossário

| Termo | Definição |
|-------|-----------|
| **RLS** | Row Level Security - políticas de acesso por linha |
| **JWT** | JSON Web Token - token de autenticação |
| **MTTD** | Mean Time To Detect - tempo médio de detecção |
| **MTTR** | Mean Time To Respond - tempo médio de resposta |
| **DPO** | Data Protection Officer - encarregado LGPD |

---

*Guia mantido pela equipe de segurança AgriRoute Connect*
