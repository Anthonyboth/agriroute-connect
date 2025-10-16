# Sistema de Reporte de Erros de Painéis do Usuário

## Visão Geral

Sistema dedicado para reportar **imediatamente** ao Telegram todos os erros que aparecem nos painéis dos usuários (ErrorBoundary), garantindo visibilidade total e resposta rápida da equipe de suporte.

## Arquitetura

### 1. Edge Function: `report-user-panel-error`

**Função:** Receber, enriquecer, persistir e notificar erros de painéis ao Telegram.

**Características:**
- **Pública** (`verify_jwt = false`) para cobrir páginas sem login
- **Sempre notifica** ao Telegram (sem filtros de deduplicação)
- Enriquece dados com IP, User-Agent, Referer no servidor
- Retorna `{ notified, errorLogId }` para feedback ao usuário

**Payload esperado:**
```typescript
{
  errorType: 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'NETWORK' | 'PAYMENT',
  errorCategory: 'SIMPLE' | 'CRITICAL',
  errorMessage: string,
  errorStack?: string,
  errorCode?: string,
  module?: string,
  functionName?: string,
  route?: string,
  userId?: string,
  userEmail?: string,
  metadata?: Record<string, any>
}
```

**Resposta:**
```typescript
{
  success: boolean,
  notified: boolean,
  errorLogId: string,
  message: string
}
```

### 2. Frontend: ErrorMonitoringService

**Novo método:** `reportUserPanelError(report: ErrorReport)`
- Chama `supabase.functions.invoke('report-user-panel-error')`
- Gerencia fila offline
- Retorna status de notificação

**Detecção automática:**
- `isUserPanelRoute(pathname)` identifica rotas de painel
- `context.userFacing = true` força uso da função exclusiva
- Classificação de erros DOM como `CRITICAL`

**Palavras-chave DOM críticas:**
- `removeChild`
- `insertBefore`
- `hydration`
- `hydrate`

### 3. Frontend: ErrorBoundary

**Comportamento:**
1. Captura erro com `componentDidCatch`
2. Detecta painel baseado na URL
3. Chama `ErrorMonitoringService.captureError()` com `userFacing: true`
4. Persiste `notified` e `errorLogId` no state
5. Exibe UI condicional ao usuário

**UI de Feedback:**

**Quando notified = true:**
```
✓ Alerta enviado ao suporte
ID: [errorLogId]
```

**Quando notified = false:**
```
⚠️ Erro registrado, reenvio pendente
ID: [errorLogId]
[Botão: 🔄 Enviar novamente]
```

**Anti-loop:** Botão desabilitado por 5s após clique (throttle simples).

### 4. Telegram: Formato da Mensagem

```
🚨 ERRO NO PAINEL DO USUÁRIO

📍 Localização:
  Rota: /dashboard/company
  Painel: Transportadora
  Componente: CompanyDashboard

❌ Erro:
  Mensagem: Cannot read property 'map' of undefined
  Código: ERR_JS_001
  Categoria: CRITICAL / FRONTEND

👤 Usuário:
  Email: usuario@exemplo.com
  ID: abc-123-def

🌐 Contexto:
  Navegador: Mozilla/5.0 Chrome/120.0
  IP: 192.168.***
  Timestamp: 2025-10-16T20:45:33.000Z

📋 Stack (primeiras 10 linhas):
<pre>
at CompanyDashboard.render (CompanyDashboard.tsx:245)
at finishClassComponent (react-dom.js:1234)
...
</pre>

🔧 Auto-correção:
  Tentada: Não

🔗 Referência: f3a9b2c1-...
```

## Fluxo Completo

```
1. Erro ocorre no painel
   ↓
2. ErrorBoundary.componentDidCatch captura
   ↓
3. ErrorMonitoringService.captureError({ userFacing: true })
   ↓
4. Detecta isUserPanelRoute → chama reportUserPanelError
   ↓
5. Edge Function report-user-panel-error:
   - Enriquece com IP, UA
   - Insert em error_logs (status='NOTIFIED')
   - Invoke send-telegram-alert
   - Update telegram_notified
   - Retorna { notified, errorLogId }
   ↓
6. ErrorBoundary exibe status ao usuário
   ↓
7. Telegram recebe mensagem rica
   ↓
8. Suporte pode buscar no ErrorLogsPanel por errorLogId
```

## Configuração

**supabase/config.toml:**
```toml
[functions.report-user-panel-error]
verify_jwt = false
```

**Variáveis de ambiente:**
- `TELEGRAM_BOT_TOKEN` (configurado)
- `TELEGRAM_CHAT_ID` (configurado)

## Segurança

- **Função pública:** Rate limiting pode ser adicionado posteriormente
- **Sem SQL bruto:** Usa Supabase client
- **IP mascarado:** Últimos octetos ocultados no Telegram
- **User-Agent abreviado:** Primeiras 3 partes apenas

## Testes

**Forçar erro DOM em /dashboard/company:**
```typescript
throw new Error('Test removeChild error');
```

**Verificar:**
1. ErrorBoundary exibe mensagem
2. `notified = true` e `errorLogId` presente
3. Mensagem chega no Telegram com todos os campos
4. ErrorLogsPanel mostra entry com `user_panel=true`

**Teste offline:**
1. Desligar rede
2. Causar erro
3. Verificar enfileiramento
4. Reconectar e confirmar envio

## Manutenção

**Adicionar novas rotas de painel:**
Editar `isUserPanelRoute` em `errorMonitoringService.ts`:
```typescript
const userPanelRoutes = [
  '/dashboard', '/company', '/app', 
  '/painel', '/profile', '/driver', 
  '/producer', '/provider',
  '/nova-rota' // adicionar aqui
];
```

**Ajustar formato Telegram:**
Editar seção `isUserPanelError` em `send-telegram-alert/index.ts`.

## Suporte

**Como usar o errorLogId:**
1. Usuário reporta erro e fornece ID
2. Admin acessa ErrorLogsPanel
3. Busca por ID
4. Analisa stack, contexto e metadata
5. Corrige e notifica usuário

**Reenvio manual:**
- Usuário clica em "🔄 Enviar novamente"
- Invoca `handleRetry` no ErrorBoundary
- Chama novamente `captureError` com flag `retry: true`
- Atualiza UI com novo status

## Métricas

**Observar no ErrorLogsPanel:**
- Total de erros com `metadata.user_panel = true`
- Taxa de `notified = true` vs `false`
- Rotas mais afetadas
- Usuários mais impactados
- Padrões de stack traces

**Dashboards futuros:**
- Gráfico de erros de painel por dia/hora
- Top 10 mensagens de erro
- Alertas para spikes de erros
