

# Plano: Sistema Completo de Carteira AgriRoute

## Dimensão do Projeto

Este é um sistema financeiro completo com ~20 tabelas novas, ~10 edge functions, ~30 componentes de frontend e integração em 4 painéis. Dado o tamanho, a implementação será dividida em **fases incrementais**, cada uma entregando funcionalidade testável.

---

## Fase 1 — Fundação: Banco de Dados + Hook Central + Aba Carteira nos 4 painéis

### 1.1 Migração de Banco de Dados (SQL)

Criar as tabelas core do sistema financeiro:

```text
wallets                      → Carteira por perfil (1:1 com profiles)
  id, profile_id, wallet_type (PRODUTOR|MOTORISTA|TRANSPORTADORA|PRESTADOR),
  available_balance, pending_balance, reserved_balance, blocked_balance,
  status (active|blocked|under_review), created_at, updated_at

ledger_entries               → Fonte da verdade contábil (append-only)
  id, wallet_id, entry_type, amount, balance_before, balance_after,
  reference_type, reference_id, description, metadata, created_at

wallet_transactions          → Operações do usuário
  id, wallet_id, transaction_type (deposit|withdrawal|transfer|payment|
  payout|refund|fee|credit_use|advance|auto_deduction),
  amount, status (pending|completed|failed|cancelled|under_review),
  pix_key, pix_key_type, description, metadata, 
  created_by, approved_by, created_at, completed_at

credit_accounts              → Crédito de Transporte por perfil
  id, wallet_id, profile_id, credit_limit, used_amount, available_limit,
  status (active|blocked|pending_approval|suspended),
  approved_by, approved_at, created_at

credit_transactions          → Uso/pagamento de crédito
  id, credit_account_id, transaction_type (use|payment|auto_deduction|refund),
  amount, installments, freight_id, description, created_at

credit_installments          → Parcelas de crédito
  id, credit_transaction_id, installment_number, amount, due_date,
  paid_amount, paid_at, status (pending|paid|overdue|auto_deducted)

freight_receivables           → Fretes a receber (lastro para antecipação)
  id, freight_id, owner_wallet_id, owner_type (driver|carrier),
  total_amount, committed_amount, liquidated_amount,
  status (eligible|partially_committed|fully_committed|liquidated|cancelled|disputed)

receivable_advances           → Antecipações
  id, wallet_id, total_requested, fee_amount, net_amount,
  status (pending|approved|disbursed|settled|rejected),
  approved_by, created_at

receivable_advance_allocations → Vínculo antecipação ↔ recebível
  id, advance_id, receivable_id, allocated_amount, settled_amount, status

disputes                      → Disputas financeiras
  id, wallet_id, dispute_type, amount, status (open|under_review|resolved|rejected),
  reason, resolution, opened_by, resolved_by, created_at, resolved_at

dispute_evidence              → Evidências de disputas
  id, dispute_id, evidence_type, file_url, description, uploaded_by, created_at

risk_events                   → Eventos de risco/antifraude
  id, profile_id, event_type, severity (low|medium|high|critical),
  description, metadata, status (open|reviewed|dismissed|action_taken), created_at

payout_orders                 → Ordens de saque
  id, wallet_id, amount, pix_key, pix_key_type, 
  status (pending_review|approved|processing|completed|rejected|failed),
  reviewed_by, reviewed_at, created_at

admin_financial_audit_logs    → Audit trail admin
  id, admin_id, action, target_type, target_id, details, created_at

reconciliation_runs           → Rodadas de reconciliação
  id, run_date, total_wallets, inconsistencies_found, 
  details, status (completed|failed), created_at
```

Adicionar campos no `freights`:
- `operation_owner_type` (enum: 'driver' | 'carrier')
- `financial_owner_id` (UUID → profiles.id)
- `executor_driver_id` (UUID → profiles.id, nullable)

**RLS:** Cada tabela com política usando `get_my_profile_id()`. Ledger é append-only (sem UPDATE/DELETE para authenticated). Admin via `has_role()`.

**Trigger automático:** Criar carteira automaticamente quando perfil é criado (ou na primeira visita à aba Carteira).

### 1.2 Edge Functions

- **`wallet-deposit`** — Registrar depósito, atualizar saldo, criar ledger entry
- **`wallet-withdraw`** — Validar saldo disponível, criar payout_order, debitar, ledger
- **`wallet-transfer`** — Transferência interna entre carteiras
- **`wallet-pay-freight`** — Reservar saldo para pagamento de frete
- **`wallet-credit-use`** — Usar crédito de transporte
- **`wallet-advance-receivable`** — Antecipar recebível com validação de lastro
- **`wallet-payout-driver`** — Repasse da transportadora ao motorista (com auto-desconto)
- **`wallet-admin-actions`** — Bloquear/desbloquear, aprovar crédito, revisar saques
- **`wallet-reconciliation`** — Verificar consistência saldos vs ledger

Todas seguem o padrão: CORS headers, validação JWT manual, Zod validation, ledger entry obrigatório.

### 1.3 Frontend — Componentes Core

```text
src/components/wallet/
  WalletTab.tsx                → Container principal com 2 sub-abas
  WalletOverview.tsx           → Cards de saldo (disponível, pendente, reservado, bloqueado)
  WalletStatement.tsx          → Extrato com filtros por tipo
  WalletDepositModal.tsx       → Modal de adicionar dinheiro
  WalletWithdrawModal.tsx      → Modal de saque via Pix
  WalletTransferModal.tsx      → Transferência interna
  PaymentManagementTab.tsx     → Sub-aba Gestão de Pagamentos
  CreditAccountCard.tsx        → Card de crédito de transporte
  CreditSimulationModal.tsx    → Simulação de uso de crédito
  CreditInstallments.tsx       → Lista de parcelas
  ReceivableAdvanceCard.tsx    → Card de antecipação
  AdvanceSimulationModal.tsx   → Simulação de antecipação
  DisputesList.tsx             → Lista de disputas
  DisputeModal.tsx             → Abrir/ver disputa
  PayoutConfirmModal.tsx       → Confirmação de segurança para ações críticas

src/hooks/
  useWallet.ts                 → Hook central: fetch carteira, saldos, transações
  useWalletActions.ts          → Ações: depositar, sacar, transferir
  useCredit.ts                 → Crédito: conta, uso, parcelas
  useReceivableAdvance.ts      → Antecipação de recebíveis
  useDisputes.ts               → Disputas financeiras
```

### 1.4 Integração nos Dashboards

**Renomear** a aba "Pagamentos" para "Carteira" nos 4 painéis:

- **ProducerDashboard.tsx:** Substituir `TabsTrigger` "Pagamentos" → "Carteira", renderizar `<WalletTab role="PRODUTOR" />`
- **DriverDashboard.tsx:** Substituir tab "Pagamentos" → "Carteira", renderizar `<WalletTab role="MOTORISTA" />` com regras de afiliado
- **CompanyDashboard.tsx:** Adicionar tab "Carteira" com `<WalletTab role="TRANSPORTADORA" />`
- **AdminPanelV2:** Expandir `/financeiro` com os novos dados (carteiras, crédito, antecipações, disputas, risco, reconciliação)

### 1.5 Governança Financeira — Motorista Afiliado

O `WalletTab` receberá flags:
- `isAffiliated: boolean`
- `affiliatedCompanyId?: string`

Quando afiliado:
- Ocultar antecipação de recebíveis de fretes da transportadora
- Mostrar apenas repasses recebidos no extrato
- Permitir crédito pessoal separado
- Auto-desconto de parcelas no repasse (via edge function `wallet-payout-driver`)

### 1.6 Admin Financeiro Expandido

Expandir `AdminFinancial.tsx` com abas internas:
- **Visão Geral** — totais consolidados (carteiras, crédito, antecipações, disputas)
- **Carteiras** — tabela de todas as carteiras com filtros
- **Crédito** — contas de crédito, aprovação, limites
- **Antecipações** — solicitações pendentes/aprovadas
- **Saques** — fila de revisão
- **Disputas** — gestão de disputas
- **Risco** — eventos de risco, contas sinalizadas
- **Reconciliação** — rodadas, inconsistências
- **Auditoria** — log de ações admin

---

## Fase 2 — Regras de Negócio Avançadas

- Auto-desconto de parcelas de crédito em repasses
- Scoring de risco automatizado
- Reconciliação periódica
- PIN financeiro (estrutura base)

---

## Preservação de Fluxos Existentes

- A tabela `external_payments` e seus fluxos continuam funcionando
- O `ProducerPaymentsTab` existente será movido para dentro da sub-aba "Gestão de Pagamentos"
- O `DriverPaymentsTab` existente vira parte da "Gestão de Pagamentos" do motorista
- Nenhum componente existente será deletado — apenas re-encapsulado

---

## Resumo de Entregáveis

| Item | Quantidade estimada |
|------|-------------------|
| Tabelas novas | ~16 |
| Colunas novas em freights | 3 |
| Edge Functions | ~9 |
| Componentes React | ~15 |
| Hooks | ~5 |
| Modificações em dashboards | 4 |

A implementação começa pela Fase 1 completa, que já entrega o sistema navegável e testável nos 4 painéis.

