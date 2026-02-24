
# Plano de Otimizacao de Performance - DriverDashboard

## Resumo

O dashboard do motorista (3.446 linhas) bloqueia a tela inteira com um spinner enquanto 7 fetches paralelos completam. Aceitar um frete demora segundos para aparecer na aba "Em Andamento". Trocar de abas renderiza todos os 15+ paineis simultaneamente.

## Mudancas

### FASE 1: Updates Otimistas (aceitar frete = feedback imediato)

**Arquivo: `src/pages/DriverDashboard.tsx`**

No handler `handleFreightAction` (linha ~2354), apos o `toast.success`, adicionar update otimista no cache do React Query ANTES dos refetches:

```typescript
// ANTES dos invalidateQueries, adicionar:
// ✅ UPDATE OTIMISTA: Invalidar driver-ongoing-cards para forcar refetch imediato
queryClient.invalidateQueries({ queryKey: ['driver-ongoing-cards'] });
```

No listener `freight:accepted` (linha ~1726), tambem adicionar `driver-ongoing-cards`:
```typescript
queryClient.invalidateQueries({ queryKey: ['driver-ongoing-cards'] });
```

### FASE 2: Remover loading bloqueante

**Arquivo: `src/pages/DriverDashboard.tsx`**

1. No `useEffect` de `loadData` (linhas 1648-1710): Remover o padrao `setLoading(true) → await Promise.all → setLoading(false)`. Substituir por:
   - `setLoading(false)` imediatamente (dashboard visivel)
   - Disparar os fetches em background sem `await`
   - Cada aba mostra seus proprios skeletons via React Query (`isLoading`)

2. Remover o early return com `AppSpinner` (linhas 2473-2475):
   ```typescript
   // REMOVER:
   if (loading) {
     return <AppSpinner fullscreen />;
   }
   ```
   O `loading` state pode ser mantido inicialmente como `false` (valor padrao) ja que nao bloqueara mais.

### FASE 3: Lazy Rendering de Abas

**Arquivo: `src/pages/DriverDashboard.tsx`**

Envolver cada `TabsContent` em renderizacao condicional. Apenas a aba ativa monta seu conteudo:

```typescript
// ANTES (todas montadas):
<TabsContent value="available">
  <DriverAvailableTab ... />
</TabsContent>

// DEPOIS (lazy):
<TabsContent value="available">
  {activeTab === 'available' && <DriverAvailableTab ... />}
</TabsContent>
```

Aplicar para TODAS as abas pesadas:
- `available` → DriverAvailableTab
- `ongoing` → DriverOngoingTab  
- `scheduled` → DriverScheduledTab
- `calendar` → DriverAreasTab
- `cities` → DriverCitiesTab
- `services` → DriverServicesTab
- `my-requests` → MyRequestsTab
- `my-trips` → bloco de propostas inline
- `counter-offers` → bloco inline
- `vehicles` → DriverVehiclesTab
- `payments` → bloco inline
- `advances` → DriverAdvancesTab
- `ratings` → DriverRatingsTab
- `chat` → DriverChatTab
- `historico` → DriverHistoryTab
- `affiliations` → DriverAffiliationsTab
- `reports` → DriverReportsTab
- `fiscal` → FiscalTab

**Nota**: O React Query ja tem cache com `staleTime` de 5-10 minutos, entao ao voltar para uma aba, os dados aparecem instantaneamente do cache.

### Ajuste no useDriverOngoingCards

**Arquivo: `src/hooks/useDriverOngoingCards.ts`**

Mudar `refetchOnMount: 'always'` para `refetchOnMount: true` (linha 133). Com `staleTime` de 10 minutos, isso evita refetch desnecessario quando o componente remonta dentro do periodo de cache:

```typescript
refetchOnMount: true, // ✅ Usa cache se fresh, refetch se stale
```

---

## Detalhes Tecnicos

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/DriverDashboard.tsx` | Remover loading bloqueante, lazy tabs, otimistic updates |
| `src/hooks/useDriverOngoingCards.ts` | refetchOnMount: true |

### Resultado Esperado

- **Carregamento inicial**: Dashboard visivel imediatamente (sem spinner fullscreen)
- **Aceitar frete**: Tab "Em Andamento" atualizada via invalidacao do React Query (<500ms)
- **Troca de abas**: Instantanea (dados servidos do cache React Query)
- **Reducao de DOM**: De ~15 abas renderizadas para 1 aba ativa
