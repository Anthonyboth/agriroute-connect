# Auditoria de Segurança - Edge Functions

**Data:** 02/12/2025  
**Versão:** 1.0  
**Responsável:** Equipe AgriRoute Connect

## Visão Geral

Este documento audita todas as Edge Functions do AgriRoute Connect, identificando mecanismos de segurança em uso e recomendações de melhoria.

---

## Funções COM JWT Obrigatório (verify_jwt = true)

Estas funções requerem autenticação via Bearer token:

| Função | Descrição | Segurança Adicional |
|--------|-----------|---------------------|
| `accept-freight-multiple` | Aceitar proposta de frete | RLS + validação de role |
| `admin-recalculate-all-antt` | Recalcular preços ANTT | Verificação admin via user_roles |
| `calculate-driver-balance` | Calcular saldo do motorista | RLS user isolation |
| `create-stripe-account` | Criar conta Stripe | Validação de role motorista |
| `driver-update-freight-status` | Atualizar status do frete | Permissão de assignment |
| `process-driver-payment` | Processar pagamento | Validação de ownership |
| `provider-spatial-matching` | Matching de prestadores | Role PRESTADOR_SERVICOS |
| `send-freight-notifications` | Enviar notificações | Token de autorização |
| `tracking-service` | Serviço de rastreamento | JWT + validação de frete |

---

## Funções SEM JWT (verify_jwt = false) - Análise Detalhada

### 1. Webhooks de Pagamento

| Função | Justificativa | Segurança Alternativa |
|--------|---------------|----------------------|
| `payment-webhook` | Callback do Stripe | ✅ Validação de assinatura Stripe |
| `stripe-webhook` | Eventos de subscription | ✅ Validação de assinatura Stripe |

**Status:** ✅ Adequado - Assinatura criptográfica do Stripe

---

### 2. Calculadoras Públicas

| Função | Justificativa | Segurança Alternativa |
|--------|---------------|----------------------|
| `calculate-route` | Cálculo público de rotas | ✅ Sem dados sensíveis, rate limiting |
| `antt-calculator` | Cálculo de preço mínimo | ✅ Sem dados sensíveis, read-only |

**Status:** ✅ Adequado - Operações somente leitura sem dados pessoais

---

### 3. Validação de Usuários e Convites

| Função | Justificativa | Segurança Alternativa | Status |
|--------|---------------|----------------------|--------|
| `validar-token-convite` | Validar convite de motorista | ⚠️ Zod schema definido mas não usado | **CORRIGIDO** |
| `processar-cadastro-motorista` | Cadastro via convite | ⚠️ Necessita validação completa | PENDENTE |
| `validate-guest-user` | Usuários não logados | ✅ CAPTCHA + rate limiting | OK |

---

### 4. Monitoramento e Segurança (Cron Jobs)

| Função | Justificativa | Segurança Alternativa |
|--------|---------------|----------------------|
| `continuous-security-monitor` | Monitor contínuo | ✅ Chamado apenas via pg_cron interno |
| `daily-security-report` | Relatório diário | ✅ Chamado apenas via pg_cron interno |
| `intelligent-alert-system` | Sistema de alertas | ✅ Chamado apenas via pg_cron interno |
| `security-auto-response` | Resposta automática | ✅ Chamado apenas via pg_cron interno |
| `monitor-suspicious-roles` | Monitor de roles | ✅ Chamado apenas via pg_cron interno |
| `monitor-auto-confirm-logs` | Monitor de auto-confirm | ✅ Chamado apenas via pg_cron interno |
| `process-telegram-queue` | Processar fila Telegram | ✅ Chamado apenas via pg_cron interno |

**Status:** ✅ Adequado - Funções internas sem exposição pública direta

---

### 5. Notificações

| Função | Justificativa | Segurança Alternativa |
|--------|---------------|----------------------|
| `send-notification` | Enviar notificações | ✅ Validação de payload + rate limiting |
| `send-telegram-alert` | Alertas Telegram | ✅ Uso interno, rate limiting |
| `telegram-error-notifier` | Erros para Telegram | ✅ Validação de formato, throttling |
| `send-delivery-deadline-notifications` | Notif. de prazo | ✅ Cron interno |

**Status:** ✅ Adequado

---

### 6. Cancelamento Automático

| Função | Justificativa | Segurança Alternativa |
|--------|---------------|----------------------|
| `auto-cancel-freights` | Cancelar fretes vencidos | ⚠️ Admin token verificado | OK |
| `cancel-overdue-now` | Cancelar imediatamente | ✅ X-Admin-Token header obrigatório |

**Status:** ✅ Adequado - Token de admin verificado

---

## Correções Implementadas

### ✅ validar-token-convite (CORRIGIDO)

**Antes:**
```typescript
const { token } = await req.json() // Sem validação
```

**Depois:**
```typescript
const rawBody = await req.json()
const validatedInput = validateInput(TokenRequestSchema, rawBody)
const { token } = validatedInput
```

---

## Recomendações Pendentes

### 1. processar-cadastro-motorista
- Adicionar schema Zod completo para todos os campos do cadastro
- Implementar rate limiting por IP (máx 3 cadastros/hora)

### 2. provider-spatial-matching
- Adicionar rate limiting por usuário (máx 10 requests/minuto)
- Já possui JWT, porém função exposta incorretamente como pública

### 3. Todas as funções de webhook
- Implementar logging detalhado de tentativas inválidas
- Alertar Telegram em caso de assinaturas inválidas repetidas

---

## Matriz de Segurança

| Mecanismo | Funções Aplicáveis |
|-----------|-------------------|
| JWT Obrigatório | 9 funções |
| Validação Zod | 15 funções |
| Rate Limiting | 8 funções |
| Assinatura Webhook | 2 funções |
| Admin Token | 2 funções |
| pg_cron Interno | 7 funções |

---

## Conclusão

- **21 funções públicas** analisadas
- **19 adequadas** com mecanismos alternativos de segurança
- **1 corrigida** (validar-token-convite)
- **1 pendente** de melhoria (processar-cadastro-motorista)

A arquitetura de segurança está adequada para a fase atual de desenvolvimento/testes do AgriRoute Connect, conforme as diretrizes de segurança do projeto.
