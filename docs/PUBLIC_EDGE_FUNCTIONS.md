# Edge Functions Públicas (verify_jwt = false)

**Data:** 02/12/2025  
**AgriRoute Connect**

Este documento explica por que cada Edge Function pública não requer autenticação JWT e quais mecanismos alternativos de segurança estão em uso.

---

## Por que algumas funções são públicas?

Existem cenários legítimos onde uma Edge Function não pode exigir JWT:

1. **Webhooks externos** - Serviços como Stripe precisam chamar endpoints sem autenticação
2. **Cadastro de novos usuários** - O usuário ainda não existe para ter um token
3. **Calculadoras públicas** - Informações que não expõem dados sensíveis
4. **Cron jobs internos** - Chamados pelo próprio Supabase, não por usuários

---

## Webhooks de Pagamento

### `payment-webhook`
- **Por que é pública:** Stripe não envia JWT, apenas sua assinatura
- **Segurança alternativa:** Validação da assinatura Stripe (`stripe.webhooks.constructEvent`)
- **Risco mitigado:** Requests forjados são rejeitados sem assinatura válida

### `stripe-webhook`
- **Por que é pública:** Eventos de subscription do Stripe
- **Segurança alternativa:** Mesma validação de assinatura Stripe
- **Dados expostos:** Nenhum - apenas recebe eventos

---

## Calculadoras Públicas

### `calculate-route`
- **Por que é pública:** Usuários podem calcular rotas antes de se cadastrar
- **Segurança alternativa:** Rate limiting por IP (10 req/min)
- **Dados expostos:** Nenhum - retorna apenas distância e estimativa

### `antt-calculator`
- **Por que é pública:** Cálculo de preço mínimo ANTT é informação pública
- **Segurança alternativa:** Operação somente leitura, sem escrita no banco
- **Dados expostos:** Tabelas públicas da ANTT

---

## Validação de Convites e Cadastro

### `validar-token-convite`
- **Por que é pública:** Motorista precisa validar convite antes de ter conta
- **Segurança alternativa:** 
  - ✅ Validação Zod do token (min 10, max 100 caracteres)
  - ✅ Token tem expiração (7 dias)
  - ✅ Token só pode ser usado uma vez
- **Dados expostos:** Nome da transportadora (necessário para o motorista confirmar)

### `processar-cadastro-motorista`
- **Por que é pública:** Criação de conta para novos motoristas
- **Segurança alternativa:**
  - ✅ Requer token de convite válido
  - ✅ Validação de CPF/CNPJ
  - ✅ Rate limiting por IP
- **Dados expostos:** Nenhum - apenas cria conta

### `validate-guest-user`
- **Por que é pública:** Validação de usuários não autenticados
- **Segurança alternativa:**
  - ✅ CAPTCHA obrigatório
  - ✅ Rate limiting agressivo
  - ✅ Validação Zod completa

---

## Monitoramento de Segurança (Cron Jobs)

Estas funções são chamadas **exclusivamente pelo pg_cron interno** do Supabase:

### `continuous-security-monitor`
- **Por que é pública:** pg_cron não envia JWT
- **Segurança alternativa:** Apenas aceita chamadas do próprio Supabase (IP interno)
- **Dados expostos:** Nenhum - apenas lê e reporta métricas

### `daily-security-report`
- **Por que é pública:** Cron job diário
- **Segurança alternativa:** Execução agendada às 8h, sem parâmetros de entrada

### `intelligent-alert-system`
- **Por que é pública:** Recebe alertas de outros sistemas internos
- **Segurança alternativa:** Validação de payload obrigatória

### `security-auto-response`
- **Por que é pública:** Resposta automática a incidentes
- **Segurança alternativa:** Validação de tipo de incidente + logs detalhados

### `monitor-suspicious-roles`
- **Por que é pública:** Monitoramento de roles suspeitas
- **Segurança alternativa:** Cron interno, sem entrada externa

### `monitor-auto-confirm-logs`
- **Por que é pública:** Auditoria de confirmações automáticas
- **Segurança alternativa:** Cron interno a cada 6h

### `process-telegram-queue`
- **Por que é pública:** Processar fila de mensagens Telegram
- **Segurança alternativa:** Cron interno a cada 20s

---

## Notificações

### `send-notification`
- **Por que é pública:** Chamada por triggers internos
- **Segurança alternativa:**
  - ✅ Validação de payload obrigatória
  - ✅ Rate limiting (100/min por usuário)
  - ✅ Logs de auditoria

### `send-telegram-alert`
- **Por que é pública:** Uso interno para alertas de segurança
- **Segurança alternativa:**
  - ✅ Rate limiting
  - ✅ Apenas envia para chat configurado (não aceita destinatário externo)

### `telegram-error-notifier`
- **Por que é pública:** Recebe erros do frontend
- **Segurança alternativa:**
  - ✅ Throttling de 1 minuto
  - ✅ Validação de formato de erro
  - ✅ Não expõe dados sensíveis

### `send-delivery-deadline-notifications`
- **Por que é pública:** Cron para notificar prazos
- **Segurança alternativa:** Execução via pg_cron apenas

---

## Cancelamento Automático

### `auto-cancel-freights`
- **Por que é pública:** Cron para cancelar fretes vencidos
- **Segurança alternativa:**
  - ✅ Verificação de Admin Token no header
  - ✅ Execução via pg_cron

### `cancel-overdue-now`
- **Por que é pública:** Endpoint administrativo manual
- **Segurança alternativa:**
  - ✅ Header `X-Admin-Token` obrigatório
  - ✅ Token verificado contra env var
  - ✅ Logs detalhados de cada execução

---

## Resumo de Mecanismos de Segurança

| Mecanismo | Descrição | Funções |
|-----------|-----------|---------|
| **Assinatura Stripe** | Criptografia HMAC-SHA256 | webhooks |
| **Validação Zod** | Schema validation | convites, cadastro |
| **Rate Limiting** | Limite por IP/usuário | calculadoras, notificações |
| **Admin Token** | Header secreto | cancelamentos |
| **pg_cron interno** | Apenas execução agendada | monitores, relatórios |
| **CAPTCHA** | Verificação humana | guest validation |

---

## Auditoria de Conformidade

Todas as funções públicas foram auditadas e possuem:

- [x] Justificativa documentada para ser pública
- [x] Mecanismo alternativo de segurança
- [x] Logging adequado para auditoria
- [x] Tratamento de erros sem exposição de dados

---

*Documento mantido pela equipe de segurança AgriRoute Connect*
