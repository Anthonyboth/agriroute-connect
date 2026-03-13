# 🐛 AgriRoute — Biblioteca de Bugs Conhecidos

Registro permanente de bugs críticos encontrados e corrigidos.
Use este documento como referência para evitar regressões.

---

## FRT-062: Flash-Crash na Play Store (server.url em release)

**Severidade:** 🔴 Crítica  
**Plataforma:** Android (Play Store)  
**Sintoma:** App abre, mostra splash, fecha imediatamente  
**Causa:** `capacitor.config.json` continha `server.url` apontando para preview do Lovable em builds de release. O app tentava carregar URL remota que não respondia.  
**Correção:** Guard condicional com `CAPACITOR_LIVE_RELOAD` env var. Server block só é incluído em dev.  
**Validação:** `validate-native-release.mjs` bloqueia build se `server.url` estiver presente sem guard.  
**Data:** 2025-12

---

## FRT-065: ClassNotFoundException no AndroidManifest

**Severidade:** 🔴 Crítica  
**Plataforma:** Android (Play Store)  
**Sintoma:** App crasha ao abrir com `ClassNotFoundException`  
**Causa:** `AndroidManifest.xml` usava nome relativo `.MainActivity` que resolvia para pacote errado quando `applicationId` diferia do pacote Java real.  
**Correção:** Usar nomes de classe completamente qualificados: `android:name="app.lovable.f2dbc20153194f90a3cc8dd215bbebba.MainActivity"`  
**Data:** 2026-01

---

## FRT-071: Plugin "not implemented" crash

**Severidade:** 🔴 Crítica  
**Plataforma:** Android/iOS  
**Sintoma:** `Error: plugin is not implemented` ao acessar Camera/Geolocation  
**Causa:** `capacitor.plugins.json` ausente ou incompleto após `npx cap sync`  
**Correção:** Validador verifica presença de plugins críticos no JSON. SplashScreen tratado como warning não-bloqueante.  
**Validação:** `validate-native-release.mjs --require-android-assets`  
**Data:** 2026-01

---

## FRT-072: Incompatibilidade de versão major entre plugins Capacitor

**Severidade:** 🟡 Alta  
**Plataforma:** Android/iOS  
**Sintoma:** Erros de build ou runtime em plugins nativos  
**Causa:** Plugins `@capacitor/*` com major version diferente do `@capacitor/core`  
**Correção:** Todos os pacotes `@capacitor/*` devem compartilhar o mesmo major version  
**Validação:** `validate-native-release.mjs` verifica alinhamento automático  
**Data:** 2026-01

---

## FRT-077: Loop infinito de reload em Capacitor

**Severidade:** 🔴 Crítica  
**Plataforma:** Android/iOS (Capacitor)  
**Sintoma:** App entra em loop de tela branca e splash infinito  
**Causa:** Serviços de auto-recuperação (errorAutoCorrector, securityAutoHeal) chamavam `window.location.reload()` em ambiente nativo, causando loop infinito  
**Correção:** Guard `!isNativePlatform` antes de qualquer `window.location.reload()`. Em ambiente Capacitor, apenas loga o erro sem recarregar.  
**Validação:** `validate-native-release.mjs` verifica ausência de reloads não-guardados  
**Data:** 2026-02

---

## FRT-078: AAB incompleto — classes.dex missing na Play Store ⭐ NOVO

**Severidade:** 🔴 Crítica  
**Plataforma:** Android (Play Store exclusivamente)  
**Sintoma:** App funciona via `adb install` mas crasha na Play Store. Log mostra:
```
W riroute.connect: Failed to find entry 'classes.dex': Entry not found
```
**Comportamento:** App abre → mostra splash → fecha imediatamente (apenas via Play Store)  

**Causa raiz:**  
O AAB foi gerado SEM executar `npx cap sync android` antes do `gradlew bundleRelease`.  
Isso resulta em:
- `android/app/src/main/assets/` vazio (sem `public/index.html`, sem `capacitor.config.json`)
- AAB com ~9 MB ao invés de ~12-13 MB
- Quando a Play Store faz Split APK delivery (`base.apk` + `split_config.*.apk`), os arquivos críticos estão ausentes

**Por que funciona via ADB:**  
O APK instalado via `adb` é monolítico (um único arquivo). A Play Store faz split delivery, dividindo em múltiplos APKs. Se o bundle original estiver incompleto, os splits herdam o problema.

**Correção:**  
1. Pipeline atômico: `npm run build` → `npx cap sync android` → `gradlew bundleRelease` (NUNCA pular o sync)
2. Script `build-android-release.mjs` automatiza toda a sequência com validações entre cada etapa
3. Script `validate-aab.mjs` inspeciona o AAB gerado antes do upload

**Validação automática:**
```bash
# Pipeline completo (recomendado)
npm run mobile:build:android

# Validar AAB existente
node scripts/validate-aab.mjs

# Checklist de tamanho
# ✅ AAB ≥ 11 MB = build correto
# ❌ AAB < 10 MB = assets faltando
```

**Arquivos do AAB que DEVEM existir:**
```
base/dex/classes.dex          ← código Java/Kotlin compilado
base/assets/public/index.html ← entry point do web app
base/assets/capacitor.config.json
base/assets/capacitor.plugins.json
base/manifest/AndroidManifest.xml
base/assets/public/assets/*.js ← bundles JS compilados
```

**Data:** 2026-03-13
