# Sistema de Monitoramento e Autocorreção de Erros

## ✅ IMPLEMENTADO

### Backend
- ✅ Tabela `error_logs` criada
- ✅ Tabela `telegram_message_queue` criada
- ✅ Edge Function `report-error` criada
- ✅ Edge Function `send-telegram-alert` criada
- ✅ Edge Function `process-telegram-queue` criada
- ✅ Secret `TELEGRAM_BOT_TOKEN` configurado

### Frontend
- ✅ `ErrorMonitoringService` - Captura e classifica erros
- ✅ `ErrorAutoCorrector` - Autocorreção automática
- ✅ `useErrorHandler` - Hook para componentes
- ✅ `ErrorLogsPanel` - Painel admin para visualizar logs
- ✅ Integração com `App.tsx` - Handlers globais
- ✅ Integração com `ErrorBoundary` - Captura de erros React

## 📋 CONFIGURAÇÃO NECESSÁRIA

### 1. Ativar Extensões no Supabase

No Supabase Dashboard → SQL Editor, execute:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Configurar Cron Job

No Supabase Dashboard → SQL Editor, execute:

```sql
SELECT cron.schedule(
  'process-telegram-queue-every-5-minutes',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url:='https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/process-telegram-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### 3. Adicionar Painel de Logs ao AdminPanel

Adicione ao `src/pages/AdminPanel.tsx`:

```tsx
import { ErrorLogsPanel } from '@/components/ErrorLogsPanel';

// Adicionar nova tab:
<TabsContent value="error-logs">
  <ErrorLogsPanel />
</TabsContent>
```

## 🚀 COMO FUNCIONA

### Captura Automática
- **Erros React**: Capturados pelo `ErrorBoundary`
- **Erros JavaScript**: Capturados por `window.error`
- **Promise Rejections**: Capturados por `unhandledrejection`
- **Erros de API**: Podem ser enviados manualmente com `useErrorHandler()`

### Classificação
- **CRITICAL**: Pagamentos, segurança, database, cálculos ANTT
- **SIMPLE**: Timeouts, cache, network temporários

### Autocorreção
- Network timeout → Retry com backoff
- 401 Unauthorized → Refresh token
- Cache corrupto → Limpar cache
- State inconsistente → Reload página

### Notificações Telegram
- **Sempre notifica**: Erros críticos
- **Notifica se**: Erro recorrente (3+ vezes em 1h)
- **NÃO notifica**: Erro simples autocorrigido, já notificado nas últimas 6h

## 📱 TELEGRAM

**Grupo**: AgriRoute Monitoramento  
**Chat ID**: -4964515694  
**Bot**: AgriRouteMonitor_Bot

### Formato da Mensagem

```
🚨 ERRO DETECTADO NO AGRIROUTE CONNECT

📱 Módulo: CompanyDashboard
⚙️ Função: handleAcceptFreight
🔴 Categoria: CRÍTICO
💥 Erro: unique constraint violation

🔁 Tentativa de correção: SIM
   └─ Ação: Retry com backoff
   └─ Status: FALHOU

🕒 Data/Hora: 16/10/2025 18:30:45
👤 Usuário: user@example.com
📍 Contexto: /dashboard/company
```

## 🧪 TESTAR

### Teste de Notificação Telegram (Recomendado)

A maneira mais fácil de testar o sistema:

1. Acesse `/dashboard/company`
2. Clique no botão **"🔔 Testar Telegram"**
3. Verifique se a mensagem chegou no grupo do Telegram
4. Confirme os logs da edge function

### Teste via cURL

```bash
curl -X POST \
  https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/test-telegram \
  -H "Content-Type: application/json" \
  -d '{"source": "manual_test", "userEmail": "test@example.com"}'
```

### Teste de Erros no Código

```typescript
// Simular erro simples
throw new Error('Network timeout test');

// Simular erro crítico
throw new Error('Payment processing failed - Stripe error');

// Usar hook em componente
const handleError = useErrorHandler();
try {
  // código
} catch (error) {
  handleError(error, { module: 'MyComponent', functionName: 'myFunction' });
}
```

### Troubleshooting Telegram

**❌ "TELEGRAM_BOT_TOKEN não configurado"**
- Configure o secret nas [Edge Functions Settings](https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/settings/functions)

**❌ "Telegram API error: 401"**
- Token inválido, regenere o bot token com @BotFather

**❌ "Telegram API error: 400"**
- Chat ID incorreto, verifique se o bot foi adicionado ao grupo
- Chat ID atual: `-4964515694`

**❌ "Edge Function returned non-2xx"**
- Verifique os [logs da função](https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/functions/test-telegram/logs)
- Confirme que o secret está configurado corretamente

## 📊 ESTATÍSTICAS

No painel admin você verá:
- Total de erros nas últimas 24h
- Erros críticos vs simples
- Taxa de autocorreção
- Erros persistentes não resolvidos
