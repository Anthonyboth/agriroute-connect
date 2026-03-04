

# Plano: Corrigir Inconsistências no Fluxo de Fretes

## Problemas Identificados

1. **Frete NÃO precisa de aprovação admin** — O workflow inclui `APPROVED` entre `NEW` e `OPEN`, mas o produtor cria e o frete já vai direto ao marketplace.

2. **Pulo de LOADED não pode existir** — A edge function `driver-update-trip-progress-fast` permite `LOADING → IN_TRANSIT` (pulando `LOADED`), mas a regra de negócio diz que após LOADED o frete não pode mais ser cancelado. Se LOADED é pulável, essa trava de cancelamento fica inconsistente.

3. **Após pagamento confirmado, dados devem ir para histórico/relatórios** — O `useFreightHistoryPersistence` já salva snapshots em certos momentos, mas precisa garantir que após o motorista confirmar recebimento do pagamento (`confirmed`), os dados vão para `operation_history` e ficam disponíveis na aba de relatórios.

---

## Correções Planejadas

### 1. Remover `APPROVED` do Workflow

**Arquivos afetados:**
- `src/security/freightWorkflowGuard.ts` — Remover `APPROVED` de `WORKFLOW_ORDER`, `STATUS_LABELS_PTBR`, tipo `FreightWorkflowStatus`, e `ROLE_ALLOWED_TRANSITIONS`
- `src/security/freightActionMatrix.ts` — Remover entradas para status `APPROVED`
- `src/security/freightActionDispatcher.ts` — Remover referências a `APPROVED`
- `src/security/i18nGuard.ts` — Remover label de `APPROVED`
- `src/lib/freight-status-resolver.ts` — Remover `APPROVED` do `STATUS_INDEX`
- `src/hooks/useFreightCancellation.ts` — Remover `APPROVED` de `PRODUCER_ACTIVE_STATUSES`
- `src/hooks/useFreightShareActions.ts` — Remover de listas de status

**Novo fluxo:** `NEW → OPEN → ACCEPTED → LOADING → LOADED → IN_TRANSIT → DELIVERED_PENDING_CONFIRMATION → DELIVERED → COMPLETED`

### 2. Eliminar o Pulo de LOADED

**Arquivos afetados:**
- `supabase/functions/driver-update-trip-progress-fast/index.ts` — Remover a exceção que permite `LOADING → IN_TRANSIT`. LOADED passa a ser **obrigatório** para todos os tipos de frete (incluindo rurais).
- A tolerância de "pulo de 2 etapas" será ajustada para no máximo 1 etapa, e a exceção específica `LOADING→IN_TRANSIT` será removida.

**Regra reforçada:** Após LOADED, cancelamento é bloqueado (já implementado em `useFreightCancellation.ts`).

### 3. Garantir Persistência no Histórico Após Pagamento Confirmado

**Situação atual:** `useFreightHistoryPersistence` salva snapshots via RPC `save_freight_completion_snapshot`, mas a chamada `onPaymentConfirmedByDriver` precisa ser verificada para garantir que:
- O registro vá para `operation_history` (trigger de banco)
- Os dados fiquem visíveis em `ReportsDashboardPanel` via RPC `get_reports_dashboard`

**Ação:** Verificar se o trigger que popula `operation_history` é disparado quando o status atinge `COMPLETED` (após pagamento confirmado). Se não existir, criar trigger ou ajustar o existente para garantir que dados cheguem às tabelas `freight_history`, `freight_assignment_history` e `operation_history` ao finalizar o ciclo de pagamento.

---

## Resumo de Impacto

| Mudança | Arquivos Frontend | Edge Functions | Banco |
|---------|-------------------|----------------|-------|
| Remover APPROVED | ~7 arquivos | — | — |
| LOADED obrigatório | — | 1 edge function | — |
| Histórico pós-pagamento | 1-2 hooks | — | Verificar trigger |

