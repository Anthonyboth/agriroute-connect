# API Documentation - AgriRoute Edge Functions

## Visão Geral

Este documento descreve todas as Edge Functions disponíveis na API do AgriRoute, incluindo exemplos de requisições e respostas.

## Autenticação

A maioria das funções requer autenticação via JWT Bearer Token:

```http
Authorization: Bearer <seu_jwt_token>
```

Funções públicas (sem JWT) estão marcadas com 🔓.

---

## Funções de Frete

### `accept-freight-multiple`

Aceita um frete para transporte.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/accept-freight-multiple
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "num_trucks": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Frete aceito com sucesso",
  "assignments": [
    {
      "id": "uuid-do-assignment",
      "freight_id": "uuid-do-frete",
      "driver_id": "uuid-do-motorista",
      "status": "ACCEPTED",
      "agreed_price": 1500.00
    }
  ]
}
```

**Erros:**
- `400` - Parâmetros inválidos
- `401` - Não autenticado
- `404` - Frete não encontrado
- `409` - Frete não disponível ou motorista já tem frete ativo

---

### `safe-update-freight`

Atualiza dados de um frete com validação de autorização.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/safe-update-freight
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "updates": {
    "pickup_date": "2025-12-15T10:00:00Z",
    "notes": "Observações adicionais"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Frete atualizado com sucesso",
  "freight": {
    "id": "uuid-do-frete",
    "pickup_date": "2025-12-15T10:00:00Z",
    "notes": "Observações adicionais"
  }
}
```

**Erros:**
- `400` - Dados de entrada inválidos
- `401` - Não autenticado
- `403` - Sem permissão para atualizar este frete
- `404` - Frete não encontrado

---

### `cancel-freight-safe`

Cancela um frete de forma segura.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/cancel-freight-safe
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "reason": "Motivo do cancelamento"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Frete cancelado com sucesso"
}
```

---

## Funções de Pagamento

### `create-freight-payment`

Cria um pagamento para um frete.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/create-freight-payment
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "amount": 1500.00
}
```

**Response (200):**
```json
{
  "success": true,
  "payment_id": "uuid-do-pagamento",
  "checkout_url": "https://checkout.stripe.com/..."
}
```

---

### `create-freight-advance`

Solicita adiantamento para um frete.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/create-freight-advance
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "advance_percentage": 0.3
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Solicitação de adiantamento enviada ao produtor",
  "advance_id": "uuid-do-adiantamento",
  "requested_amount": 450.00
}
```

---

### `request-withdrawal`

Solicita saque do saldo disponível.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/request-withdrawal
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 500.00,
  "pix_key": "email@exemplo.com"
}
```

**Response (200):**
```json
{
  "withdrawal_id": "uuid-do-saque",
  "amount": 500.00,
  "net_amount": 490.00,
  "platform_fee": 10.00,
  "status": "processing"
}
```

**Erros:**
- `400` - Saldo insuficiente ou chave PIX inválida
- `401` - Não autenticado
- `403` - Apenas motoristas podem solicitar saques

---

### `stripe-webhook` 🔓

Webhook para eventos do Stripe.

**Autenticação:** Assinatura Stripe

**Headers Obrigatórios:**
```http
stripe-signature: <assinatura>
```

**Eventos Suportados:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.payment_succeeded`
- `customer.subscription.deleted`

---

## Funções de Rastreamento

### `tracking-service/locations`

Atualiza localização do motorista.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/tracking-service/locations
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "lat": -23.5505,
  "lng": -46.6333,
  "speed": 60,
  "heading": 180,
  "accuracy": 10
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Localização atualizada"
}
```

---

### `tracking-service/incidents`

Registra incidente de rastreamento.

**Autenticação:** Obrigatória (JWT)

**Request:**
```http
POST /functions/v1/tracking-service/incidents
Content-Type: application/json
Authorization: Bearer <token>

{
  "freight_id": "uuid-do-frete",
  "incident_type": "GPS_DISABLED",
  "severity": "HIGH",
  "description": "GPS foi desabilitado"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Incidente registrado"
}
```

---

## Funções de Usuário

### `validate-guest-user` 🔓

Valida usuário convidado (sem cadastro).

**Autenticação:** Não requerida (CAPTCHA obrigatório)

**Request:**
```http
POST /functions/v1/validate-guest-user
Content-Type: application/json

{
  "name": "João Silva",
  "phone": "11999998888",
  "document": "123.456.789-00",
  "captchaToken": "token-do-hcaptcha"
}
```

**Response (200):**
```json
{
  "success": true,
  "prospect_id": "uuid-do-prospect",
  "message": "Informações recebidas com sucesso!"
}
```

**Erros:**
- `400` - Documento inválido
- `403` - CAPTCHA falhou
- `429` - Rate limit excedido

---

### `send-notification`

Envia notificação para usuário.

**Autenticação:** Obrigatória (JWT ou Service Role)

**Request:**
```http
POST /functions/v1/send-notification
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "uuid-do-usuario",
  "title": "Título da Notificação",
  "message": "Corpo da mensagem",
  "type": "info",
  "data": {
    "action": "navigate",
    "route": "/dashboard"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "notification_id": "uuid-da-notificacao"
}
```

---

## Funções de Segurança

### `report-error` 🔓

Reporta erro do frontend.

**Autenticação:** Não requerida (Rate Limited)

**Request:**
```http
POST /functions/v1/report-error
Content-Type: application/json

{
  "errorType": "FRONTEND",
  "errorCategory": "CRITICAL",
  "errorMessage": "Cannot read property 'x' of undefined",
  "errorStack": "Error: ...",
  "module": "FreightDetails",
  "route": "/dashboard/driver"
}
```

**Response (200):**
```json
{
  "success": true,
  "errorLogId": "uuid-do-log",
  "notified": true
}
```

**Erros:**
- `429` - Rate limit excedido

---

### `security-auto-response`

Resposta automática a incidentes de segurança.

**Autenticação:** Obrigatória (JWT + Admin Role)

**Request:**
```http
POST /functions/v1/security-auto-response
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "type": "BRUTE_FORCE",
  "severity": "CRITICAL",
  "ip_address": "192.168.1.1",
  "user_id": "uuid-do-usuario"
}
```

**Response (200):**
```json
{
  "success": true,
  "actions_taken": [
    {
      "action": "BLOCK_IP",
      "success": true,
      "details": "IP bloqueado por 24 horas"
    }
  ]
}
```

---

## Funções de Calculadora

### `antt-calculator` 🔓

Calcula preço mínimo ANTT para frete.

**Autenticação:** Não requerida

**Request:**
```http
POST /functions/v1/antt-calculator
Content-Type: application/json

{
  "distance_km": 500,
  "axles": 6,
  "cargo_category": "CARGA_GERAL",
  "table_type": "A"
}
```

**Response (200):**
```json
{
  "minimum_price": 1250.00,
  "price_per_km": 2.50,
  "fixed_charge": 150.00,
  "diesel_price": 6.00,
  "effective_date": "2025-01-01"
}
```

---

### `calculate-route` 🔓

Calcula rota entre dois pontos.

**Autenticação:** Não requerida

**Request:**
```http
POST /functions/v1/calculate-route
Content-Type: application/json

{
  "origin": {
    "lat": -23.5505,
    "lng": -46.6333
  },
  "destination": {
    "lat": -22.9068,
    "lng": -43.1729
  }
}
```

**Response (200):**
```json
{
  "distance_km": 430,
  "duration_minutes": 320,
  "route_polyline": "encoded_polyline_string",
  "waypoints": []
}
```

---

## Códigos de Erro Comuns

| Código | Significado |
|--------|-------------|
| `AUTH_REQUIRED` | Token de autenticação necessário |
| `AUTH_ERROR` | Token inválido ou expirado |
| `FORBIDDEN` | Sem permissão para esta ação |
| `NOT_FOUND` | Recurso não encontrado |
| `VALIDATION_ERROR` | Dados de entrada inválidos |
| `RATE_LIMITED` | Limite de requisições excedido |
| `INTERNAL_ERROR` | Erro interno do servidor |

---

## Rate Limits

| Endpoint | Limite | Janela |
|----------|--------|--------|
| `report-error` | 10 req | 1 hora |
| `validate-guest-user` | 3 req | 1 hora |
| `antt-calculator` | 100 req | 1 hora |
| Outros (autenticados) | 1000 req | 1 hora |

---

## Ambiente de Testes

URL Base: `https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/`

Para testes locais:
```bash
supabase functions serve
```

URL Local: `http://localhost:54321/functions/v1/`
