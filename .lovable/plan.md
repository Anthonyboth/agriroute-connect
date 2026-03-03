

## Problemas Identificados nos Prints

### Problema 1: "Carregando destino..." no card de frete em andamento
**Causa raiz:** O frete `d1b0e039` tem `destination_city: null` e `destination_state: null` no banco, mas possui `destination_address: "Poxoréu - Destino Seed 7"`. O componente `FreightInProgressCard.tsx` (linha 409-411) só exibe a cidade/estado, e quando ambos são nulos mostra "Carregando destino..." em vez de usar o fallback `destination_address`.

**Correção:** Alterar `FreightInProgressCard.tsx` para usar `destination_address` como fallback quando `destination_city`/`destination_state` forem nulos, igual ao que `FreightCard.tsx` já faz.

### Problema 2: Card "Ativas" mostrando 0 enquanto badge "Em Andamento" mostra 1
**Causa raiz:** O `statistics` memo (linha 1872) usa `ongoingBadgeCount` que vem de `useDriverOngoingCards` (React Query). Porém, o `statistics` memo também referencia `visibleOngoing` e `activeAssignments` internamente (linhas 1855-1861) sem tê-los no array de dependências. Esse código morto dentro do memo causa confusão mas não é a causa direta. A causa real é que o memo NÃO inclui `visibleOngoing` e `activeAssignments` nas dependências, e esses são dados de uma pipeline SEPARADA (`fetchOngoingFreights`). A discrepância visual no print sugere race condition na carga inicial.

**Correção:** 
1. Remover o código morto dentro do `statistics` memo (linhas 1838-1869 que calculam `activeTripsCount` mas nunca o usam)
2. Limpar o array de dependências para incluir apenas o que é efetivamente usado
3. Garantir que o stats card e o badge usem exatamente a mesma variável `ongoingBadgeCount`

### Problema 3: Frete agendado aparecendo na aba "Em Andamento"
O frete `d1b0e039` tem pickup_date 2026-03-20 (17 dias no futuro) e status OPEN no banco. O assignment tem status ACCEPTED. No hook `useDriverOngoingCards`, assignments NÃO são filtrados por data de pickup (por design - linhas 439-447), então aparecem em "Em Andamento" mesmo quando deveriam ser "Agendados". A seção do card mostra "Coleta em 16 dias", confirmando que é um frete futuro. 

**Correção:** No `useDriverOngoingCards`, filtrar assignments ACCEPTED com pickup_date futura para que apareçam apenas em "Agendados", usando a mesma lógica `isInProgressFreight` aplicada aos fretes diretos.

## Plano de Implementação

### 1. Corrigir fallback de destino no FreightInProgressCard (FreightInProgressCard.tsx)
- Linha 409-411: trocar `'Carregando destino...'` por fallback para `destination_address`
- Aplicar mesma lógica que `FreightCard.tsx` já usa: `freight.destination_address || 'Destino não informado'`

### 2. Limpar statistics memo (DriverDashboard.tsx)
- Remover código morto (cálculo de `activeTripsCount` que nunca é retornado)
- Manter `activeTrips: ongoingBadgeCount` como fonte única de verdade
- Limpar dependências do useMemo

### 3. Filtrar assignments agendados no useDriverOngoingCards (useDriverOngoingCards.ts)
- Nos `enrichedAssignments` (linha 439), adicionar filtro: se assignment status é ACCEPTED e pickup_date do frete é futura, excluir dos resultados (ficam apenas para "Agendados")
- Manter assignments em LOADING/LOADED/IN_TRANSIT sempre visíveis independente da data

