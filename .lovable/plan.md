

## Plano: Suprimir erro falso do SplashScreen plugin no Android

### Problema

O plugin `@capacitor/splash-screen` não está registrado no Android nativo (não foi adicionado via `npx cap sync` ou o APK está desatualizado). Quando o hook `useSplashScreen.ts` tenta chamar `SplashScreen.hide()`, o Capacitor lança o erro "SplashScreen plugin is not implemented on android". O catch usa `console.error`, que é interceptado pelo reporter do Telegram, gerando spam de alertas falsos.

### Mudanças

| Arquivo | Mudança |
|---|---|
| `src/hooks/useSplashScreen.ts` | Linha 44: trocar `console.error` por `console.warn` — o erro é esperado e não deve disparar alertas |
| `src/hooks/usePanelErrorTelegramReporter.ts` | Adicionar `'plugin is not implemented'` ao `IGNORED_PATTERNS` como safety net |

### Detalhamento

**1. useSplashScreen.ts — Downgrade para warn**

```typescript
// Linha 44: trocar
console.error('[SplashScreen] ❌ Erro ao ocultar splash:', error);
// por
console.warn('[SplashScreen] Plugin não disponível, ignorando:', error);
```

O `setIsHidden(true)` já está lá, então o app continua normalmente.

**2. usePanelErrorTelegramReporter.ts — Filtro adicional**

Adicionar ao array `IGNORED_PATTERNS`:
```typescript
'plugin is not implemented',
```

Isso cobre qualquer plugin Capacitor não registrado (SplashScreen, PushNotifications, etc.) e impede alertas falsos no Telegram.

### Resultado

- Erro do SplashScreen não aparece mais no Telegram
- App continua funcionando normalmente (splash é ignorada quando plugin não existe)
- Proteção genérica para qualquer plugin Capacitor não registrado

