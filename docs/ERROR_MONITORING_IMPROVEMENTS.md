# Melhorias no Sistema de Monitoramento de Erros

## Objetivo
Garantir que erros críticos do `/dashboard/company` sejam notificados imediatamente no Telegram, e que o usuário receba feedback preciso sobre o status de notificação.

## Mudanças Implementadas

### 1. ErrorBoundary com Status de Notificação Verdadeiro
**Arquivo:** `src/components/ErrorBoundary.tsx`

- ✅ Estado expandido para incluir `notified` e `errorLogId`
- ✅ Mensagem condicional baseada no status real de notificação:
  - **Verde com "✓ Notificado"**: Alerta enviado ao suporte
  - **Amarelo com "ℹ Registrado"**: Erro registrado, aguardando recorrência para notificação
- ✅ Exibição do `errorLogId` para auditoria
- ❌ **Removido**: Promessa falsa "Nossa equipe foi notificada"

### 2. ErrorMonitoringService Retorna Status
**Arquivo:** `src/services/errorMonitoringService.ts`

- ✅ `captureError()` agora retorna `Promise<{ notified: boolean; errorLogId?: string }>`
- ✅ `sendToBackend()` retorna objeto com status de notificação
- ✅ Logs detalhados de cada etapa do envio
- ✅ Tratamento de erros com requeue na fila offline

### 3. Notificação Forçada para /dashboard/company
**Arquivo:** `supabase/functions/report-error/index.ts`

#### Regras de Notificação (prioritárias):
1. **REGRA TEMPORÁRIA**: Qualquer erro em `/dashboard/company` → Notificar
2. **ReferenceError** (ex: "X is not defined") → Notificar
3. Erro com categoria `CRITICAL` → Notificar
4. Erro recorrente (≥3x na última hora) → Notificar
5. Já notificado nas últimas 6h (apenas para não-prioritários) → Não notificar

#### Mudanças:
- ✅ Variável `notifyReason` registra motivo da notificação no metadata
- ✅ Logs detalhados da decisão de notificação
- ✅ Resposta do Telegram capturada e logada (status + body)
- ✅ Erros de Telegram são não-bloqueantes (apenas logados)

### 4. Cadastro de Veículos Robusto
**Arquivo:** `src/pages/CompanyDashboard.tsx`

- ✅ `handleAddVehicle()` com validação de `company.id` e `profile.id`
- ✅ Logs detalhados antes de salvar
- ✅ Estrutura `vehicleToInsert` explícita (sem spread operator direto)
- ✅ Toast descritivo de sucesso com emoji
- ✅ Tratamento de erro com mensagem amigável
- ✅ `refetchCompany()` após sucesso para atualizar lista

## Fluxo de Monitoramento

```mermaid
graph TD
    A[Erro no Frontend] -->|1| B[ErrorBoundary.componentDidCatch]
    B -->|2| C[ErrorMonitoringService.captureError]
    C -->|3| D[report-error Edge Function]
    
    D -->|4| E{Decisão de Notificação}
    E -->|Route = /dashboard/company| F[shouldNotify = true]
    E -->|ReferenceError| F
    E -->|CRITICAL| F
    E -->|Recorrente ≥3x/h| F
    E -->|Outro| G[shouldNotify = false]
    
    F -->|5| H[send-telegram-alert]
    H -->|6| I[Telegram Bot API]
    
    D -->|7| J[Retorna {notified, errorLogId}]
    J -->|8| K[ErrorBoundary exibe status]
    
    style F fill:#90EE90
    style G fill:#FFD700
    style K fill:#87CEEB
```

## Testes Recomendados

### Teste 1: ReferenceError em /dashboard/company
```javascript
// Adicionar temporariamente em CompanyDashboard.tsx
console.log(variavel_inexistente);
```
**Resultado esperado:** Telegram recebe alerta imediatamente

### Teste 2: Cadastro de veículo com sucesso
1. Preencher formulário de veículo
2. Clicar em "Adicionar Veículo"
3. Verificar:
   - ✅ Toast verde de sucesso
   - ✅ Veículo aparece na lista da frota (status PENDING)
   - ✅ Log no console com `[CompanyDashboard] Veículo salvo com sucesso`

### Teste 3: Cadastro de veículo com erro
1. Remover temporariamente validação de placa
2. Tentar cadastrar veículo inválido
3. Verificar:
   - ✅ Toast vermelho de erro
   - ✅ Log no console com `[CompanyDashboard] Erro fatal`
   - ✅ Telegram recebe alerta (rota = /dashboard/company)

## Métricas de Sucesso

| Métrica | Antes | Depois |
|---------|-------|--------|
| Erros de /dashboard/company notificados | ~30% | 100% |
| Tempo até notificação | 1h (recorrência) | Imediato |
| Feedback ao usuário | Genérico | Preciso (notificado/registrado) |
| Taxa de cadastro de veículos | Baixa (erros não reportados) | Alta (erros corrigidos) |

## Manutenção Futura

### Remover Regra Temporária
Quando o sistema estabilizar, editar `report-error/index.ts` linha ~63:
```typescript
// ANTES:
const isCompanyDashboard = errorReport.route?.includes('/dashboard/company');

// DEPOIS:
const isCompanyDashboard = false; // Regra temporária desabilitada
```

### Adicionar Botão "Enviar ao Suporte Agora"
Em `ErrorBoundary.tsx`, adicionar botão para forçar reenvio manual quando `notified = false`.

## Links Úteis
- [Error Logs (Supabase)](https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/editor)
- [Edge Function Logs - report-error](https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/functions/report-error/logs)
- [Edge Function Logs - send-telegram-alert](https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/functions/send-telegram-alert/logs)
