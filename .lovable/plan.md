
Objetivo imediato: impedir que o popup “Baixe agora” apareça dentro do app instalado, mantendo exatamente o comportamento atual no navegador móvel.

1) Diagnóstico (já confirmado no código)
- O `MobileAppDownloadPopup` hoje decide exibição apenas por User-Agent (`android`/`ios`).
- Em app nativo Capacitor, o User-Agent também é mobile, então o popup aparece indevidamente.
- Resultado: o modal de “baixar app” aparece para quem já está no app instalado.

2) Correção mínima (sem mudar layout/UX)
- Arquivo: `src/components/MobileAppDownloadPopup.tsx`
- Adicionar um gate de ambiente antes de qualquer timer/exibição:
  - `isNativeContainer`: bloquear quando estiver em Capacitor (`Capacitor.isNativePlatform()` + fallback robusto já usado no projeto: `window.Capacitor`, `protocol === 'capacitor:'`, `localhost` sem porta).
  - `isStandaloneInstall`: bloquear quando for app instalado via navegador (PWA standalone), usando:
    - `window.matchMedia('(display-mode: standalone)')`
    - `navigator.standalone === true` (iOS)
- Regra final: popup só pode aparecer em **mobile browser tab** (não nativo, não standalone).
- Preservar 100% do resto:
  - delay de 3s
  - dismiss por 30 dias
  - textos/CTA/design
  - bloqueio de scroll enquanto modal aberto

3) Blindagem anti-regressão (“biblioteca de bugs”)
- Arquivo: `src/hooks/useRegressionShield.ts`
- Adicionar nova entrada de regressão (ex.: `FRT-064`) com:
  - bug: popup de download exibido em app já instalado
  - causa raiz: detecção por UA sem checagem de container
  - regra: “popup de download só em navegador móvel”
  - test cases explícitos (native Android/iOS não exibe; browser mobile exibe; standalone não exibe)

4) Teste automatizado mínimo (para nunca repetir)
- Criar teste focado no gate de ambiente do popup (unitário), validando matriz:
  - Android/iOS nativo => não renderiza
  - PWA standalone => não renderiza
  - navegador mobile comum => renderiza após delay
  - desktop => não renderiza

5) Validação de aceite (manual rápida)
```text
A. Play Store app instalado (Android): popup NÃO aparece
B. iOS app nativo: popup NÃO aparece
C. Chrome/Safari mobile (aba normal): popup aparece após 3s
D. PWA instalada (atalho): popup NÃO aparece
E. Desktop: popup NÃO aparece
```

Detalhes técnicos (resumo)
- Mudança cirúrgica em um componente + registro em `useRegressionShield`.
- Sem alteração visual.
- Sem alteração de fluxo de navegação.
- Sem alteração de textos ou timing existentes.
