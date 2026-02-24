
Objetivo: eliminar o travamento (spinner infinito + “Página sem resposta” no Chrome) no preview do motorista com foco em causa raiz de sobrecarga de render/requisições, não apenas fallback visual.

Diagnóstico consolidado (com evidências já levantadas)
1) O problema NÃO é o finding de segurança (SUPA_security_definer_view / SUPA_auth_leaked_password_protection).  
- Esses findings são de configuração/arquitetura de Supabase e não explicam congelamento de aba no browser.

2) Há sinais de “tempestade de atualização” no front:
- Session replay: overlay de spinner persistente + botão “Atualizando...” desabilitado.
- Network snapshot: múltiplos PATCH em `user_devices` em sequência curta.
- Código atual no dashboard motorista possui vários pontos de alto custo em paralelo (realtime + fetches pesados + componentes grandes).

3) Causa raiz provável principal (bug de loop de efeito em `SmartFreightMatcher`):
- `fetchCompatibleFreights` depende de `canSeeFreightByType` (função recriada a cada render).
- O efeito de refresh inicial depende de `fetchCompatibleFreights`.
- Resultado: ciclo de render → nova função → efeito dispara de novo → fetch de novo → render novamente.

4) Causa raiz provável secundária (vazamento/duplicação de heartbeat de device):
- `useDeviceRegistration` cria `setInterval` dentro de função async e o cleanup fica “perdido” (não é cleanup real do `useEffect`).
- Dependências incluem permissões, aumentando chances de recriar fluxo.
- Pode gerar chamadas duplicadas de `user_devices` e contribuir para pressão de CPU/rede.

Arquitetura de correção (hotfix cirúrgico)
```text
Antes:
DriverDashboard
  -> DriverAvailableTab
      -> SmartFreightMatcher
          useEffect(fetchCompatibleFreights) [dep função instável]
          => refetch em cascata

DeviceSetup
  -> useDeviceRegistration
      async checkAndRegister() cria interval
      cleanup não garantido
      => heartbeats duplicados

Depois:
DriverDashboard
  -> DriverAvailableTab (callbacks estáveis)
      -> SmartFreightMatcher
          fetch com deps estáveis + guard anti-loop
          refresh controlado (mount + manual + 10min + eventos realmente relevantes)

DeviceSetup
  -> useDeviceRegistration
      efeito 1: registro único
      efeito 2: heartbeat único com cleanup real
      throttling de atualização
```

Plano de implementação (arquivos e mudanças)
Fase 1 — Bloquear loop crítico de render/fetch no matcher (prioridade máxima)
1. `src/hooks/useDriverFreightVisibility.ts`
- Tornar `canSeeFreightByType` estável com `useCallback`.
- Garantir que `normalizedServiceTypes` continue memoizado e reutilizado.

2. `src/components/SmartFreightMatcher.tsx`
- Remover dependência de callback instável no `fetchCompatibleFreights`:
  - Usar `onCountsChangeRef` (`useRef`) para invocar callback sem entrar em deps do fetch.
- Revisar deps de `fetchCompatibleFreights` para conter apenas dados realmente estáveis.
- Ajustar efeito de refresh inicial para não reexecutar por identidade de função.
- Adicionar guard de frequência:
  - `lastFetchAtRef` + janela mínima (ex.: 1.5–2s) para bloquear rajadas.
- Manter auto-refresh de 10 min, mas sem recriar timer desnecessariamente.

3. `src/pages/driver/DriverAvailableTab.tsx`
- Estabilizar `onCountsChange` com `useCallback` (evitar nova identidade a cada render).
- Evitar wrappers inline para callbacks passados ao matcher quando possível.

Fase 2 — Corrigir heartbeat de dispositivo e evitar intervalos “fantasma”
4. `src/hooks/useDeviceRegistration.ts`
- Reestruturar em dois efeitos:
  - Efeito A: registro do device (once por sessão/TTL).
  - Efeito B: heartbeat (`updateLastActivity`) com cleanup real retornado pelo `useEffect`.
- Introduzir `intervalRef` explícito para garantir `clearInterval`.
- Desacoplar criação de heartbeat de mudanças de permissão.
- Adicionar throttling de atualização (`lastActivitySentAtRef`) para evitar burst acidental.

5. `src/hooks/useDevicePermissions.ts` (ajuste de contenção)
- Evitar `syncDevicePermissions` redundante se estado efetivo de permissões não mudou.
- Aplicar comparação rasa antes de PATCH.
- Manter sincronização, mas sem repetir update idêntico.

Fase 3 — Redução de pressão de realtime no dashboard (hardening)
6. `src/pages/DriverDashboard.tsx`
- Revisar subscriptions amplas sem filtro (ex.: `freights` global) para evitar reações a mudanças do sistema inteiro.
- Trocar gatilhos globais por:
  - refresh explícito em eventos do próprio usuário,
  - ou canal mais específico.
- Confirmar que `debouncedFetch*` não é recriado em cascata por deps desnecessárias.

Fase 4 — Observabilidade anti-regressão
7. Adicionar métricas leves em DEV:
- contador de execuções de `fetchCompatibleFreights` por minuto.
- contador de PATCH `user_devices` por minuto.
- warning quando ultrapassar limiar (ex.: >6/min em idle).

8. Testes automatizados (regressão)
- `SmartFreightMatcher`:
  - teste garantindo “1 fetch inicial” ao montar (sem loop por rerender).
  - teste garantindo que mudança irrelevante de estado não refaz fetch.
- `useDeviceRegistration`:
  - teste de cleanup do intervalo no unmount.
  - teste de “single heartbeat interval” mesmo com rerender.

Critérios de aceite
1) No `/dashboard/driver`, a aba não deve mais congelar o Chrome.  
2) `fetchCompatibleFreights`:
- 1 chamada no mount,
- chamadas adicionais somente por ação manual, evento válido ou auto-refresh programado.  
3) `user_devices`:
- sem rajadas de PATCH consecutivos idênticos na inicialização.  
4) Spinner de carregamento:
- some após bootstrap normal; fallback aparece apenas em timeout real.  
5) Uso de CPU perceptivelmente estável em preview (sem “Página sem resposta”).

Validação end-to-end (obrigatória após implementação)
1) Login como motorista no preview e abrir `/dashboard/driver`.  
2) Observar por 2–3 minutos sem interagir:
- sem travamento,
- sem loop visual de atualização,
- sem flood de requests.  
3) Trocar filtros/abas e validar que a tela continua responsiva.  
4) Verificar console/network para confirmar queda de frequência de fetch/patch.  
5) Repetir em mobile viewport (390x844) para confirmar estabilidade também no fluxo mobile.

Notas de segurança (contexto atual)
- O fix será exclusivamente de estabilidade/performance front-end.
- `SUPA_security_definer_view` permanece conforme decisão arquitetural já aceita neste ciclo.
- `SUPA_auth_leaked_password_protection` continua sendo configuração de dashboard Supabase e não causa este travamento específico.
