

# Hook de Cancelamento de Frete Centralizado

## Problema

1. O botao "Solicitar Cancelamento" tem CSS ruim e texto longo demais
2. Nao existe um hook centralizado para regras de cancelamento
3. As regras de cancelamento estao espalhadas em varios arquivos sem consistencia

## Regras de Negocio (conforme solicitado)

| Ator | Status do Frete | Acao Permitida |
|------|----------------|----------------|
| Motorista | ACCEPTED, LOADING | Cancelamento direto (via `cancel-freight-safe`) |
| Motorista | LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION | Solicitar cancelamento (produtor aprova) |
| Motorista | DELIVERED, COMPLETED, CANCELLED | Nenhuma |
| Produtor | Qualquer status ativo | Cancelamento direto a qualquer momento |

## Plano de Implementacao

### 1. Criar hook `useFreightCancellation` (`src/hooks/useFreightCancellation.ts`)

Hook centralizado que exporta:

- `canCancelDirectly(status, role)` -- retorna `true` se o ator pode cancelar direto
- `canRequestCancellation(status, role)` -- retorna `true` se o ator so pode solicitar
- `getCancelButtonConfig(status, role)` -- retorna `{ label, variant, action }` para o botao
- `handleDirectCancel(freightId, reason)` -- executa `cancel-freight-safe`
- `handleRequestCancel(freightId)` -- abre chat/notifica produtor para aprovacao

Logica interna:
- Motorista: cancela direto em ACCEPTED e LOADING; solicita em LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION
- Produtor: cancela direto em qualquer status exceto COMPLETED e CANCELLED
- Transportadora: nao cancela (apenas monitora)

### 2. Atualizar `src/lib/labels.ts`

- Mudar `SOLICITAR_CANCELAMENTO` de "Solicitar cancelamento" para "Cancelamento"

### 3. Atualizar `FreightInProgressCard.tsx` (linhas 572-591)

- Usar o hook para decidir se mostra o botao e qual texto/acao
- Corrigir o CSS do botao (o `variant="destructive"` com `w-full` ja esta ok, so precisa do texto correto)
- O botao exibira "Cancelar" quando o motorista pode cancelar direto, ou "Cancelamento" quando precisa solicitar

### 4. Atualizar `FreightCard.tsx` (linhas 814-833)

- Substituir a logica inline de status por chamada ao hook
- Remover "Solicitar" do texto do botao

### 5. Atualizar `freightActionMatrix.ts`

- Adicionar acao `REQUEST_CANCEL` para motoristas nos status LOADED, IN_TRANSIT
- Adicionar acao `CANCEL` para motoristas nos status ACCEPTED, LOADING
- Adicionar acao `CANCEL` para produtores em LOADED, IN_TRANSIT (cancelamento direto a qualquer momento)

### 6. Atualizar `DriverOngoingTab.tsx`

- Usar o hook ao inves de sempre abrir detalhes no `onRequestCancel`
- Para ACCEPTED/LOADING: cancelar direto com confirmacao
- Para LOADED+: abrir chat/solicitar ao produtor

## Arquivos Modificados

- `src/hooks/useFreightCancellation.ts` (NOVO)
- `src/lib/labels.ts` (texto do botao)
- `src/components/FreightInProgressCard.tsx` (botao e logica)
- `src/components/FreightCard.tsx` (botao produtor)
- `src/security/freightActionMatrix.ts` (novas acoes CANCEL/REQUEST_CANCEL para motorista)
- `src/pages/driver/DriverOngoingTab.tsx` (usar hook)

