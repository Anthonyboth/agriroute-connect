# Matriz de Segurança - AgriRoute Connect

**Data:** 02/12/2025  
**Versão:** 1.0

---

## 1. Matriz de Riscos

### Legenda de Severidade
- 🔴 **Crítico** - Impacto severo, ação imediata necessária
- 🟠 **Alto** - Impacto significativo, ação em 24h
- 🟡 **Médio** - Impacto moderado, ação em 7 dias
- 🟢 **Baixo** - Impacto mínimo, monitorar

---

## 2. Riscos Identificados e Mitigações

### 2.1 Autenticação e Autorização

| Risco | Severidade | Probabilidade | Mitigação | Status |
|-------|------------|---------------|-----------|--------|
| Vazamento de credenciais | 🔴 | Média | Senhas com bcrypt, tokens JWT curtos (1h) | ✅ Implementado |
| Escalação de privilégios | 🔴 | Baixa | RLS policies + user_roles table | ✅ Implementado |
| Session hijacking | 🟠 | Baixa | Refresh tokens, verificação de IP | ✅ Implementado |
| Brute force login | 🟠 | Alta | Rate limiting (5 tentativas/15min) | ✅ Implementado |
| Senha fraca | 🟡 | Alta | Leaked Password Protection (Supabase) | ⏳ Configurar manualmente |

### 2.2 Dados e Privacidade

| Risco | Severidade | Probabilidade | Mitigação | Status |
|-------|------------|---------------|-----------|--------|
| Vazamento de dados pessoais | 🔴 | Baixa | RLS isolamento, criptografia TLS | ✅ Implementado |
| Acesso não autorizado a docs | 🟠 | Média | URLs assinadas temporárias (5min) | ✅ Implementado |
| Exposição de CNH/CPF | 🟠 | Baixa | Mascaramento em logs, criptografia planejada | ⏳ Plano criado |
| Backup sem criptografia | 🟡 | Baixa | Backups Supabase criptografados | ✅ Implementado |

### 2.3 Infraestrutura

| Risco | Severidade | Probabilidade | Mitigação | Status |
|-------|------------|---------------|-----------|--------|
| DDoS | 🟠 | Média | Cloudflare CDN, rate limiting | ✅ Implementado |
| Secrets expostos | 🔴 | Baixa | Env vars, Vault, TruffleHog CI | ✅ Implementado |
| Dependências vulneráveis | 🟡 | Alta | Snyk + Dependabot | ⏳ Configurar |
| Injeção SQL | 🔴 | Baixa | Supabase client (sem raw SQL), RLS | ✅ Implementado |

### 2.4 Comunicações

| Risco | Severidade | Probabilidade | Mitigação | Status |
|-------|------------|---------------|-----------|--------|
| Man-in-the-middle | 🟠 | Baixa | TLS 1.3, HSTS | ✅ Implementado |
| Webhook forjado | 🟡 | Média | Validação assinatura Stripe | ✅ Implementado |
| SMS spoofing | 🟡 | Baixa | Não usar SMS para 2FA crítico | ✅ Decisão tomada |

---

## 3. Matriz STRIDE

| Categoria | Ameaça | Controle |
|-----------|--------|----------|
| **S**poofing | Falsificação de identidade | JWT + refresh tokens |
| **T**ampering | Modificação de dados | RLS + checksums |
| **R**epudiation | Negação de ações | Audit logs completos |
| **I**nformation Disclosure | Vazamento de info | Criptografia + RLS |
| **D**enial of Service | Indisponibilidade | Rate limiting + CDN |
| **E**levation of Privilege | Escalação | user_roles table + RLS |

---

## 4. Controles por Camada

### 4.1 Frontend (React)
- [x] Sanitização de inputs com Zod
- [x] CSP headers configurados
- [x] HTTPS obrigatório
- [x] Tokens em httpOnly cookies (quando possível)
- [x] Rate limiting de requests

### 4.2 API (Edge Functions)
- [x] JWT verification (maioria das funções)
- [x] Validação Zod em todas entradas
- [x] Rate limiting por IP/usuário
- [x] Logging de segurança
- [x] CORS configurado

### 4.3 Banco de Dados (Supabase)
- [x] RLS em todas tabelas
- [x] Sem raw SQL execution
- [x] Backups automáticos
- [x] Audit trails via audit_logs
- [x] Roles separadas (anon, authenticated, service_role)

### 4.4 Armazenamento (Storage)
- [x] Buckets com RLS
- [x] URLs assinadas temporárias
- [ ] Criptografia adicional (planejado)
- [x] Políticas por tipo de arquivo

---

## 5. Compliance LGPD

| Requisito | Status | Evidência |
|-----------|--------|-----------|
| Base legal para tratamento | ✅ | Termos de uso + consentimento |
| Minimização de dados | ✅ | Coleta apenas necessário |
| Direito de acesso | ✅ | Export de dados disponível |
| Direito de exclusão | ✅ | Delete account funcional |
| Notificação de vazamento | ✅ | Processo documentado |
| DPO designado | ✅ | agrirouteconnect@gmail.com |
| Registro de atividades | ✅ | audit_logs table |

---

## 6. Métricas de Segurança

### KPIs Monitorados
| Métrica | Alvo | Atual |
|---------|------|-------|
| Tentativas de login falhadas/dia | < 100 | Monitorado |
| Tempo médio de detecção (MTTD) | < 1h | ~15min |
| Tempo médio de resposta (MTTR) | < 24h | ~2h |
| Cobertura de RLS | 100% | 100% |
| Funções com validação Zod | 100% | 95% |

---

## 7. Plano de Resposta a Incidentes

### Níveis de Severidade

| Nível | Descrição | Tempo de Resposta | Escalação |
|-------|-----------|-------------------|-----------|
| P1 - Crítico | Vazamento de dados, sistema fora | 15 min | CEO + Jurídico |
| P2 - Alto | Tentativa de invasão detectada | 1 hora | CTO |
| P3 - Médio | Vulnerabilidade descoberta | 24 horas | Dev Lead |
| P4 - Baixo | Anomalia de segurança | 7 dias | Security Team |

### Contatos de Emergência
- **DPO:** agrirouteconnect@gmail.com
- **WhatsApp:** +55 15 66 9 9942-6656
- **Telegram Alertas:** Bot configurado

---

## 8. Revisões Programadas

| Atividade | Frequência | Próxima |
|-----------|------------|---------|
| Scan de vulnerabilidades | Diário (CI) | Automático |
| Revisão de acessos | Mensal | Janeiro/2026 |
| Pen test | Anual | Q2/2026 |
| Treinamento equipe | Semestral | Junho/2026 |
| Revisão de políticas | Anual | Dezembro/2026 |

---

## 9. Exceções Aprovadas

| Exceção | Justificativa | Aprovado por | Validade |
|---------|---------------|--------------|----------|
| Edge functions públicas (webhooks) | Necessário para integração Stripe | CTO | Permanente |
| Console.log em dev | Debugging | Dev Lead | Apenas dev |

---

## 10. Histórico de Atualizações

| Data | Versão | Alteração |
|------|--------|-----------|
| 02/12/2025 | 1.0 | Criação inicial |

---

*Documento confidencial - Uso interno AgriRoute Connect*
