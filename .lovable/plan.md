
Problema reavaliado (Play Store, fecha imediato): o bug ainda pode voltar porque a blindagem atual está incompleta em 2 pontos críticos.

Do I know what the issue is? **Sim**.

Causa provável real (reincidência):
1) **Boot nativo ainda executa mecanismos web de auto-recovery/reload** em alguns caminhos (não está 100% isolado para native).  
2) **Validação de release está fraca**: hoje ela valida só `capacitor.config.ts`, mas não garante que o Android build final (`android/app/src/main/assets/capacitor.config.json`) esteja limpo nem bloqueia build no próprio Gradle.

Arquivos isolados (onde o bug pode continuar nas próximas releases):
- `src/main.tsx`
- `src/utils/pwaRecovery.ts`
- `src/lib/lazyWithRetry.ts`
- `src/components/ErrorBoundary.tsx`
- `src/components/GlobalErrorBoundary.tsx`
- `src/services/securityAutoHealService.ts`
- `scripts/validate-native-release.mjs`
- `android/app/build.gradle`
- `docs/RELEASE_CHECKLIST.md`
- `src/hooks/useRegressionShield.ts`

Plano de correção (definitivo, sem meia-medida):

1) Blindagem total “web-only recovery” fora do nativo
- Em `main.tsx`, mover `installAutoRecoveryHandlers()` para execução **apenas web** (nunca Android/iOS).
- Garantir que qualquer rotina de preview/PWA recovery não rode em `Capacitor.isNativePlatform() === true`.
- Resultado: remove loops de reload/flicker no WebView nativo.

2) Hardening dos pontos que ainda forçam reload
- Em `pwaRecovery.ts`, `lazyWithRetry.ts`, `ErrorBoundary.tsx`, `GlobalErrorBoundary.tsx`, `securityAutoHealService.ts`:
  - Se for native: **não fazer `window.location.reload()` / `location.replace()` automático**.
  - Em native, fazer fallback seguro (UI de erro + instrução) em vez de loop de reload.
- Resultado: elimina ciclo de “pisca e fecha” provocado por recovery agressivo em runtime.

3) Preflight realmente bloqueador de release (nível Gradle)
- Fortalecer `scripts/validate-native-release.mjs` para também validar:
  - `android/app/src/main/assets/capacitor.config.json` (quando existir)
  - falhar se houver `server.url` em release
  - falhar se assets Android estiverem ausentes (indicando sync incorreto antes do build)
- Em `android/app/build.gradle`, adicionar task de validação executada antes de `assembleRelease/bundleRelease`.
- Resultado: mesmo que alguém ignore npm script, o próprio build release será bloqueado se inseguro.

4) Protocolo anti-regressão formal
- Atualizar `docs/RELEASE_CHECKLIST.md` com etapa obrigatória e bloqueante:
  - `npm run mobile:sync:android:release`
  - validação explícita do `capacitor.config.json` gerado
- Atualizar FRT-062 em `useRegressionShield.ts` com regra nova:
  - “Release Android só é válida se Gradle validator passar + native recovery estiver desativado para web-only handlers”.

Validação de aceite (obrigatória após implementar):
1. Build release abre 3x seguidas sem fechar.  
2. `android/app/src/main/assets/capacitor.config.json` sem `server.url`.  
3. Sem loop de reload em native quando ocorre erro de chunk/rede.  
4. Fluxo inicial (landing/login/cadastro) abre estável.  
5. Gate de release bloqueia automaticamente qualquer tentativa futura de reintroduzir boot remoto.

Referência técnica externa usada na investigação:
- Issues do ecossistema Capacitor sobre conflitos de Service Worker/reload em Android WebView e crashes por estratégia web aplicada em container nativo — reforça a decisão de separar estritamente recovery web vs native.
