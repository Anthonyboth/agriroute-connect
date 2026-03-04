

# Plano: Corrigir Inconsistências no Fluxo de Fretes — ✅ CONCLUÍDO

## Correções Implementadas

### 1. ✅ Remover `APPROVED` do Workflow

**Arquivos alterados:**
- `src/security/freightWorkflowGuard.ts` — Removido `APPROVED` do tipo, WORKFLOW_ORDER, STATUS_LABELS_PTBR e ROLE_ALLOWED_TRANSITIONS
- `src/security/freightActionMatrix.ts` — Removida entrada `APPROVED`, admin agora publica direto para OPEN
- `src/security/freightActionDispatcher.ts` — Removido de STATUS_ORDER_MAP
- `src/security/i18nGuard.ts` — Mantido apenas na lista de termos proibidos (detecção de dados legados)
- `src/lib/freight-status-resolver.ts` — Removido do STATUS_INDEX
- `src/hooks/useFreightCancellation.ts` — Removido de PRODUCER_ACTIVE_STATUSES
- `src/hooks/useFreightShareActions.ts` — Removido de OPEN_STATUSES

**Novo fluxo:** `NEW → OPEN → ACCEPTED → LOADING → LOADED → IN_TRANSIT → DELIVERED_PENDING_CONFIRMATION → DELIVERED → COMPLETED`

### 2. ✅ Eliminar o Pulo de LOADED

**Arquivo alterado:**
- `supabase/functions/driver-update-trip-progress-fast/index.ts` — Removida exceção `LOADING → IN_TRANSIT`. Tolerância reduzida de 2 para 1 etapa máxima de pulo. LOADED agora é obrigatório para fretes padrão (fluxo simplificado para MOTO/GUINCHO/MUDANÇA já não inclui LOADED).

### 3. ✅ Garantir Persistência no Histórico Após Pagamento Confirmado

**Verificação:** O trigger `record_freight_completion()` já existia e dispara quando `freights.status` muda para `COMPLETED`, inserindo em `operation_history`.

**Gap encontrado e corrigido:** `useDriverPayments.ts` → `confirmReceipt()` apenas atualizava `external_payments.status = 'confirmed'` sem mover o frete para COMPLETED. Agora:
1. Verifica se todos os pagamentos do frete estão confirmados
2. Se sim e frete está em DELIVERED, transiciona para COMPLETED (dispara trigger → operation_history)
3. Persiste snapshot via RPC `save_freight_completion_snapshot`
