

## Problema

O tutorial auto-inicia 1500ms apos o perfil ser detectado, mas o dashboard do produtor e carregado via **lazy loading** (codigo sob demanda) + **Suspense**. Isso significa que o tutorial pode aparecer **antes** do dashboard terminar de carregar, resultando em tela branca atras do modal do tutorial.

## Causa Raiz

No `TutorialProvider.tsx`, linha 97:
```
const timer = setTimeout(() => {
  if (shouldAutoStartTutorial(...)) {
    // Inicia tutorial apos 1500ms fixos
  }
}, 1500);
```

Porem o `ProducerDashboard` e carregado com `lazyWithRetry` (download do chunk JS) e depois ainda precisa buscar dados do Supabase. 1500ms frequentemente nao e suficiente.

## Solucao

Em vez de usar um timer fixo, o tutorial so deve iniciar quando o dashboard estiver **realmente renderizado e visivel**. A abordagem:

1. **Criar um marcador no DOM**: Os dashboards ja renderizam conteudo identificavel. Vamos usar um seletor que so existe quando o dashboard esta montado (ex: `[data-dashboard-ready="true"]`).

2. **Modificar o TutorialProvider** para aguardar esse marcador:
   - Substituir o `setTimeout` de 1500ms por um **polling/observer** que espera o seletor `[data-dashboard-ready]` existir no DOM
   - Timeout maximo de 10 segundos (fallback para nao travar)
   - Apos detectar o dashboard pronto, aguardar mais 500ms para estabilizar

3. **Adicionar `data-dashboard-ready` nos dashboards**: Colocar o atributo no elemento raiz de cada dashboard principal (Produtor, Motorista, Transportadora, Prestador).

## Detalhes Tecnicos

### Arquivo: `src/tutorial/TutorialProvider.tsx`

Substituir o bloco do `setTimeout` (linhas 96-107) por logica que usa `MutationObserver` para detectar `[data-dashboard-ready="true"]` no DOM antes de iniciar:

```typescript
// Aguardar dashboard renderizar antes de iniciar tutorial
const checkDashboardReady = () => {
  return document.querySelector('[data-dashboard-ready="true"]') !== null;
};

if (checkDashboardReady()) {
  // Dashboard ja esta pronto
  setTimeout(() => startIfNeeded(), 500);
} else {
  // Observar DOM ate dashboard aparecer (max 10s)
  const observer = new MutationObserver(() => {
    if (checkDashboardReady()) {
      observer.disconnect();
      setTimeout(() => startIfNeeded(), 500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Fallback timeout
  setTimeout(() => {
    observer.disconnect();
    // Nao inicia se dashboard nao carregou
  }, 10000);
}
```

### Arquivos de Dashboard (adicionar atributo):
- `src/pages/ProducerDashboard.tsx` - adicionar `data-dashboard-ready="true"` no elemento raiz
- `src/pages/DriverDashboard.tsx` - idem
- `src/pages/CompanyDashboard.tsx` - idem
- `src/components/ServiceProviderDashboard.tsx` - idem

Exemplo: `<div data-dashboard-ready="true" className="bg-background">` no return principal de cada dashboard.

## Resultado Esperado

- O tutorial **nunca** aparece sobre tela branca
- O tutorial so inicia apos o dashboard estar visivel e estavel
- Se o dashboard demorar mais de 10 segundos para carregar, o tutorial simplesmente nao inicia automaticamente (o usuario pode iniciar manualmente depois)

