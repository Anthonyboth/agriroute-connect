

## Diagnóstico

O `MobileAppDownloadPopup` usa `Capacitor.isNativePlatform()` (import do npm) para detectar ambiente nativo. Porém, no app Capacitor, o bridge nativo pode não estar pronto quando o módulo JS é avaliado. O resto do codebase (`main.tsx`, `GlobalErrorBoundary.tsx`) já usa um padrão mais robusto que NÃO depende do import do npm:

```typescript
// Padrão robusto usado em main.tsx (linhas 163-166)
(window as any).Capacitor?.isNativePlatform?.() === true ||
window.location.protocol === 'capacitor:' ||
(window.location.hostname === 'localhost' && !window.location.port)
```

O terceiro check (`localhost` sem porta) é a chave: no Capacitor nativo, a URL é `https://localhost/` (sem porta). No browser local de dev é `localhost:5173` (com porta). O `MobileAppDownloadPopup` **não tem esse check**, e é por isso que falha no app nativo.

## Plano

### 1. Corrigir `isInstalledAppContext()` em `MobileAppDownloadPopup.tsx`

Adicionar o check `localhost` sem porta (mesmo padrão do `main.tsx`):

```typescript
function isInstalledAppContext(): boolean {
  // 1. Capacitor native — multiple fallbacks
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}

  if (typeof window !== 'undefined') {
    // 2. window.Capacitor global
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    // 3. capacitor:// protocol (iOS)
    if (window.location?.protocol === 'capacitor:') return true;
    // 4. ✅ NOVO: Capacitor Android serve de https://localhost sem porta
    if (window.location?.hostname === 'localhost' && !window.location?.port) return true;
  }

  // 5. PWA standalone
  if (typeof window !== 'undefined') {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return true;
  }

  return false;
}
```

### 2. Atualizar FRT-064 no regression shield

Adicionar o check `localhost` sem porta na documentação do fix.

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/MobileAppDownloadPopup.tsx` | Adicionar check `hostname === 'localhost' && !port` |
| `src/hooks/useRegressionShield.ts` | Atualizar FRT-064 com novo check |

### Por que funciona

- **Android nativo**: URL = `https://localhost/` → hostname `localhost`, porta vazia → bloqueado
- **iOS nativo**: URL = `capacitor://localhost/` → protocolo `capacitor:` → bloqueado (já funcionava)
- **Browser mobile**: URL = `https://agriroute.lovable.app/` → hostname diferente → popup aparece
- **Dev local**: URL = `http://localhost:5173/` → tem porta → popup aparece (correto)

