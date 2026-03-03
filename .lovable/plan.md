

## Problema Identificado

O screenshot mostra um loop de spam no console do emulador iOS:
- `[ErrorMonitoringService] Erro ao reportar ao backend: {"name":"FunctionsFetchError","context":{}}` repetido dezenas de vezes

**Causa raiz:** A edge function `report-user-panel-error` existe no codigo mas provavelmente nao esta deployed ou nao esta acessivel no emulador iOS. Quando `supabase.functions.invoke('report-user-panel-error')` falha com `FunctionsFetchError`, a linha 94 do `errorMonitoringService.ts` loga com `console.error`. Como o app esta na rota `/dashboard` (user panel route), CADA erro que ocorre no app passa por `captureError` → `reportUserPanelError` → falha → `console.error` → spam.

Adicionalmente, cada falha empurra o report para `errorQueue` (linha 95), que cresce sem limite.

## Plano de Correção

### 1. Silenciar erros nao-criticos no ErrorMonitoringService (errorMonitoringService.ts)
- Linha 94: trocar `console.error` por `console.debug` (a notificacao Telegram ja foi feita na linha 73, entao o backend falhar nao e critico)
- Nao empurrar para `errorQueue` quando o erro e `FunctionsFetchError` (evita crescimento sem limite da fila)

### 2. Adicionar circuit breaker no reportUserPanelError
- Se `report-user-panel-error` falhar 3 vezes consecutivas, parar de tentar por 5 minutos
- Evita spam de chamadas a uma function que esta fora do ar

### 3. Deploy da edge function report-user-panel-error
- Verificar e fazer deploy da function que pode nao estar deployed

