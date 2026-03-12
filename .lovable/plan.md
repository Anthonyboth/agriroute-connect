
Objetivo: eliminar o crash imediato no Android (Play Store), corrigir a regressão de boot nativo e impedir que volte a acontecer.

Contexto confirmado
- Cenário informado: fecha imediatamente ao abrir.
- Canal afetado: Play Store (produção).
- Logs web/preview mostram boot saudável; problema está no container/build nativo, não no fluxo web normal.
- Do I know what the issue is? Sim: há regressão crítica de estratégia de boot nativo (produção apontando para servidor remoto de preview + configuração arriscada de `server.url`), incompatível com estabilidade de app em loja.

Plano de implementação (hotfix + blindagem)

1) Hotfix de boot nativo (bloqueador de produção)
- Arquivo: `capacitor.config.ts`
- Remover dependência fixa de `server.url` para produção.
- Deixar `server` habilitado apenas em modo de desenvolvimento controlado por variável de ambiente.
- Sanitizar URL de live reload (sem query/path), para evitar cenários que já causaram crash Android em Capacitor.
- Resultado esperado: app de produção abre usando `dist/` local, sem depender de preview remoto.

2) Hardening no bootstrap web dentro do app nativo
- Arquivo: `src/main.tsx`
- Impedir rotinas de “preview cache cleanup” e auto-recovery PWA em ambiente nativo (Android/iOS), pois essas rotinas podem gerar reloads agressivos/flicker quando não são contexto web puro.
- Manter SW desabilitado em nativo de forma explícita (já existe parcialmente, vamos fechar todos os caminhos).
- Resultado esperado: cold start previsível no WebView nativo, sem loops de reload.

3) Blindagem anti-regressão executável (não só documental)
- Arquivos:
  - `scripts/validate-native-release.mjs` (novo)
  - `package.json`
  - `src/hooks/useRegressionShield.ts`
- Criar validação automática de release que falha build se:
  - `server.url` estiver ativo em release
  - URL de server tiver query/path inválido para boot seguro
- Adicionar scripts de pipeline:
  - `mobile:preflight:release`
  - `mobile:sync:android:release`
  - `mobile:sync:android:dev`
- Atualizar FRT-062 com regra “enforceable” (checagem automatizada), não apenas texto.

4) Procedimento de recuperação de produção
- Arquivo: `docs/RELEASE_CHECKLIST.md`
- Incluir checklist obrigatório antes de publicar AAB:
  - `npm run build`
  - `npm run mobile:preflight:release`
  - `npx cap sync android`
  - smoke test em aparelho real
- Incluir protocolo de emergência:
  - rollback de versão nativa se crash rate subir
  - bloqueio de release quando preflight falhar.

Detalhes técnicos (implementação proposta)
- `capacitor.config.ts`:
  - `const isNativeDev = process.env.CAPACITOR_LIVE_RELOAD === 'true'`
  - `server` só entra no objeto quando `isNativeDev`
  - sanitização de URL via `new URL(...)`, mantendo somente `origin`.
- `main.tsx`:
  - `const isNative = Capacitor.isNativePlatform()`
  - `ensureFreshPreviewBuild()` e handlers de recuperação PWA só para web preview, nunca para nativo.
- `validate-native-release.mjs`:
  - valida config efetiva e aborta com exit code 1 se houver risco de boot remoto em release.

Critérios de aceite (obrigatórios)
1. Android release abre sem piscar/fechar (3 aberturas seguidas).
2. Sem `server.url` no build de produção.
3. Fluxo de cadastro abre normalmente após cold start.
4. Câmera (selfie + documento) continua funcional em Android release.
5. Preflight falha automaticamente se alguém tentar reintroduzir configuração insegura.

Ordem de execução recomendada
1. Aplicar hotfix de `capacitor.config.ts`.
2. Aplicar hardening de `main.tsx`.
3. Adicionar preflight/script e atualizar `package.json`.
4. Atualizar `useRegressionShield.ts` + checklist.
5. Gerar build de release e validar em dispositivo real antes de publicar.
