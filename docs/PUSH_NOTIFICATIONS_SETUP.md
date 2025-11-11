# 🔔 Configuração de Push Notifications - AGRIROUTE

Este documento detalha a configuração completa do sistema de notificações push com VAPID keys.

---

## 📋 **VISÃO GERAL**

O sistema de push notifications foi implementado com:
- ✅ Edge Function `send-push-notification` com suporte real a Web Push API
- ✅ Edge Function `check-stale-proposals` para alertas automáticos de propostas pendentes
- ✅ Service Worker (`/sw.js`) com suporte a push events
- ✅ Hook `usePushNotifications` com VAPID real
- ✅ Component `NotificationSound` para tocar som ao receber notificações
- ✅ `NotificationCenter` com badge animado e grouping por tipo
- ✅ Tabela `proposal_reminders` para rastrear alertas enviados

---

## 🔐 **PASSO 1: GERAR VAPID KEYS**

### **Opção 1: Online (Rápido)**
1. Acesse: https://vapidkeys.com/
2. Clique em "Generate Keys"
3. Copie as chaves geradas

### **Opção 2: Via CLI (Recomendado para produção)**
```bash
npm install -g web-push
web-push generate-vapid-keys
```

Você receberá algo como:
```
Public Key: BGmH...
Private Key: q7Z...
```

---

## 🔧 **PASSO 2: CONFIGURAR SECRETS NO SUPABASE**

### **2.1 Adicionar VAPID Keys no Edge Functions**

1. Acesse o **Supabase Dashboard**
2. Vá em **Edge Functions** → **Settings**
3. Adicione os seguintes secrets:

| Secret Name | Valor |
|-------------|-------|
| `VAPID_PUBLIC_KEY` | Sua chave pública gerada |
| `VAPID_PRIVATE_KEY` | Sua chave privada gerada |
| `VAPID_EMAIL` | `mailto:contato@agriroute.com` |

### **2.2 Adicionar VAPID Public Key no Frontend**

1. Edite o arquivo `.env` do projeto:
```env
VITE_VAPID_PUBLIC_KEY=BGmH...
```

2. **IMPORTANTE:** Adicione também no `.env` do ambiente de produção (Vercel, Netlify, etc.)

---

## ⏰ **PASSO 3: AGENDAR EDGE FUNCTION DE ALERTAS**

Execute no **SQL Editor** do Supabase:

```sql
-- Agendar check-stale-proposals para rodar a cada 6 horas
SELECT cron.schedule(
  'check-stale-proposals-job',
  '0 */6 * * *', -- A cada 6 horas
  $$
  SELECT net.http_post(
    url := 'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/check-stale-proposals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Verificar job criado:**
```sql
SELECT * FROM cron.job WHERE jobname = 'check-stale-proposals-job';
```

---

## 📲 **PASSO 4: ADICIONAR SOM DE NOTIFICAÇÃO**

1. Baixe um som curto (1-2 segundos) de notificação:
   - **Fontes gratuitas:** freesound.org, zapsplat.com, pixabay.com
   - Recomendação: Som de "ding" ou "chime" suave

2. Salve como `public/sounds/notification.mp3`

3. O sistema tocará automaticamente quando novas notificações chegarem

---

## 🧪 **PASSO 5: TESTAR O SISTEMA**

### **5.1 Testar Ativação de Push**

1. Abra o app no navegador (Chrome/Firefox/Edge)
2. Faça login como produtor
3. Vá em **Configurações** → **Notificações**
4. Clique em "Ativar Notificações Push"
5. Permita notificações quando o navegador solicitar
6. Verifique que o status mudou para "Ativado"

### **5.2 Testar Push Real (via SQL)**

Execute no SQL Editor para enviar push de teste:

```sql
-- Substitua 'SEU_USER_ID' pelo ID do usuário logado
SELECT net.http_post(
  url := 'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/send-push-notification',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg'
  ),
  body := jsonb_build_object(
    'user_ids', ARRAY['SEU_USER_ID']::uuid[],
    'title', '🔔 Push Test - AGRIROUTE',
    'message', 'Se você viu esta notificação, o sistema está funcionando!',
    'type', 'test',
    'requireInteraction', true
  )
) as request_id;
```

### **5.3 Testar Alertas de Propostas Pendentes**

1. Crie uma proposta como motorista
2. Aguarde 24 horas (ou altere manualmente o `created_at` no banco para simular)
3. Execute manualmente a função:
```sql
SELECT net.http_post(
  url := 'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/check-stale-proposals',
  headers := jsonb_build_object(
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) as request_id;
```
4. Produtor deve receber notificação sobre proposta pendente

---

## 🎯 **TIPOS DE NOTIFICAÇÕES SUPORTADAS**

| Tipo | Descrição | Push Habilitado |
|------|-----------|-----------------|
| `new_proposal` | Nova proposta recebida | ✅ |
| `proposal_accepted` | Proposta aceita pelo produtor | ✅ |
| `proposal_rejected` | Proposta rejeitada | ✅ |
| `proposal_pending_reminder` | Alerta de proposta pendente (24h/48h) | ✅ |
| `location_request` | Solicitação de localização GPS | ✅ |
| `document_request` | Solicitação de documentos | ✅ |
| `route_start_request` | Solicitação para iniciar rota | ✅ |
| `delivery_confirmation_required` | Confirmação de entrega pendente | ✅ |
| `chat_message` | Nova mensagem no chat | ✅ |
| `payment_completed` | Pagamento realizado | ✅ |

---

## 📊 **MONITORAMENTO**

### **Verificar logs das Edge Functions:**
```bash
# Logs de push notifications
supabase functions logs send-push-notification --tail

# Logs de alertas de propostas
supabase functions logs check-stale-proposals --tail
```

### **Consultar alertas enviados:**
```sql
-- Ver últimos 50 reminders enviados
SELECT 
  pr.reminder_type,
  pr.sent_at,
  fp.status as proposal_status,
  p.full_name as producer_name
FROM proposal_reminders pr
JOIN freight_proposals fp ON fp.id = pr.proposal_id
JOIN freights f ON f.id = fp.freight_id
JOIN profiles p ON p.id = f.producer_id
ORDER BY pr.sent_at DESC
LIMIT 50;
```

---

## ⚠️ **TROUBLESHOOTING**

### **Push não está funcionando**
1. ✅ Verifique se VAPID keys estão configuradas (Edge Functions + Frontend)
2. ✅ Confirme que o service worker está registrado: `navigator.serviceWorker.getRegistration()`
3. ✅ Verifique permissões do navegador: `Notification.permission`
4. ✅ Teste em diferentes navegadores (Chrome, Firefox, Edge)

### **Som não está tocando**
1. ✅ Verifique que o arquivo existe em `public/sounds/notification.mp3`
2. ✅ Teste manualmente: `new Audio('/sounds/notification.mp3').play()`
3. ✅ Alguns navegadores bloqueiam autoplay - interação do usuário é necessária primeiro

### **Alertas de propostas não chegam**
1. ✅ Verifique que o cron job está rodando: `SELECT * FROM cron.job WHERE jobname = 'check-stale-proposals-job';`
2. ✅ Execute manualmente a função para testar
3. ✅ Verifique logs: `supabase functions logs check-stale-proposals`

---

## 🚀 **PRÓXIMOS PASSOS**

Após configuração completa, considere:
1. ✅ Implementar sistema de chat direto (FASE 3)
2. ✅ Criar dashboards de performance (FASE 2)
3. ✅ Adicionar relatórios personalizados (FASE 4)
4. ✅ Implementar atalhos de teclado e Kanban (FASE 5)

---

## 📚 **REFERÊNCIAS**

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [VAPID Keys](https://blog.mozilla.org/services/2016/08/23/sending-vapid-identified-webpush-notifications-via-mozillas-push-service/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
