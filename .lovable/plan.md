

# Plano de Otimizacao de Performance do App

## Diagnostico

O arquivo `DriverDashboard.tsx` possui **3.446 linhas** e e o principal gargalo de performance. Os problemas identificados sao:

### Problemas Principais

1. **Arquivo monolitico (3.446 linhas)** - O dashboard do motorista contem TODA a logica de fetch, handlers, estados e renderizacao em um unico componente. Isso causa re-renders massivos a cada mudanca de estado.

2. **Fetch em cascata no carregamento** - Ao montar o dashboard, 4-7 funcoes de fetch sao executadas em paralelo (`fetchOngoingFreights`, `fetchAvailableFreights`, `fetchMyProposals`, `fetchMyAssignments`, `fetchDriverCheckins`, `fetchPendingPayments`, `fetchTransportRequests`). Cada uma faz multiplas queries ao Supabase (ex: `fetchOngoingFreights` faz 5 queries separadas + resolutions de produtores).

3. **Duplicacao de dados** - O mesmo dado e buscado em dois lugares:
   - `fetchOngoingFreights` (linhas 775-1024) busca fretes em andamento com ~5 queries
   - `useDriverOngoingCards` (hook dedicado) faz as mesmas queries novamente quando a aba "Em Andamento" renderiza

4. **Sem updates otimistas ao aceitar fretes** - Ao aceitar um frete, o sistema invalida queries e refaz TODOS os fetches (linhas 1726-1738), causando delay perceptivel ate os dados aparecerem na aba "Em Andamento".

5. **Troca de abas re-renderiza tudo** - Todas as abas sao renderizadas simultaneamente (nao ha lazy rendering por aba). Trocar de aba forca re-render de ~30+ estados no componente pai.

6. **Tabs com `refetchOnMount: 'always'`** - O hook `useDriverOngoingCards` usa `refetchOnMount: 'always'`, forcando refetch toda vez que o componente e exibido.

---

## Solucao em 3 Fases

### FASE 1: Updates Otimistas na Aceitacao de Fretes (Impacto Imediato)
**Problema resolvido:** "Quando aceito um frete, demora a aparecer na aba Em Andamento"

- No handler `freight:accepted` (linhas 1726-1750), implementar **update otimista**: mover o frete aceito diretamente para o cache do React Query da aba "Em Andamento" ANTES de fazer o refetch de rede.
- Usar `queryClient.setQueryData` para inserir o frete na lista de ongoing imediatamente.
- O refetch em background garante consistencia sem bloquear a UI.
- Aplicar mesma logica para `service_request:accepted`.

### FASE 2: Eliminar Fetch Duplicado e Unificar com React Query
**Problema resolvido:** "Demora a abrir as informacoes nas abas" + "Carregamento lento"

- Remover as funcoes manuais `fetchOngoingFreights`, `fetchMyAssignments`, `fetchAvailableFreights` do componente monolitico.
- Utilizar exclusivamente os hooks React Query ja existentes (`useDriverOngoingCards`, `useAvailableFreights`, `useDriverAssignments`, `useDriverProposals`) que ja possuem cache inteligente.
- Remover os 12+ estados locais (`availableFreights`, `ongoingFreights`, `myProposals`, etc.) que duplicam dados ja disponíveis via React Query.
- Isso elimina o `loadData()` no `useEffect` (linhas 1648-1710) que bloqueia a UI com um `setLoading(true)` global enquanto 7 fetches paralelos completam.

### FASE 3: Lazy Rendering de Abas
**Problema resolvido:** "Mudanca de abas esta lenta"

- Envolver cada `TabsContent` em renderizacao condicional: so montar o conteudo da aba quando ela esta ativa.
- Isso evita que 15+ abas sejam renderizadas simultaneamente no DOM.
- Manter dados no cache do React Query para que a troca de abas seja instantanea (dados ja em memoria).

---

## Detalhes Tecnicos

### Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/DriverDashboard.tsx` | Remover funcoes de fetch duplicadas, estados locais redundantes, usar hooks React Query. Implementar updates otimistas. Lazy render de abas. |
| `src/hooks/useDriverData.ts` | Ajustar `useDriverAssignments` para incluir dados de frete inline (evitar fetch separado) |
| `src/pages/driver/DriverOngoingTab.tsx` | Sem mudancas (ja usa `useDriverOngoingCards` corretamente) |
| `src/pages/driver/DriverAvailableTab.tsx` | Sem mudancas (ja usa `SmartFreightMatcher`) |

### Mudanca Principal no DriverDashboard.tsx

**Antes (atual):**
```text
mount -> setLoading(true) -> 7 fetches paralelos -> aguarda todos -> setLoading(false) -> renderiza
```

**Depois (otimizado):**
```text
mount -> renderiza imediatamente com skeletons -> cada aba carrega seus dados via React Query sob demanda -> cache persiste entre trocas de aba
```

### Update Otimista na Aceitacao

```text
Aceitar frete -> update otimista no cache -> navegar para "Em Andamento" (frete ja visivel) -> refetch em background para consistencia
```

### Lazy Tabs

Cada aba so renderiza quando selecionada. Ao trocar de aba, o React Query serve dados do cache instantaneamente (staleTime de 10 minutos ja configurado). Isso reduz o numero de componentes no DOM de ~15 abas para apenas 1.

---

## Resultado Esperado

- **Aceitar frete**: aparece na aba "Em Andamento" em menos de 100ms (vs 3-5s atual)
- **Troca de abas**: instantanea (dados do cache)
- **Carregamento inicial**: dashboard visivel imediatamente com skeletons por aba
- **Reducao de requests de rede**: ~50% menos queries ao Supabase no mount inicial

