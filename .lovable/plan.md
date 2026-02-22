
# Pentest Etico Completo (Defensivo) — AgriRoute

## Visao Geral da Postura de Seguranca Atual

O AgriRoute ja possui uma arquitetura de seguranca bem estruturada com multiplas camadas. Este pentest identificou achados organizados por prioridade, com correcoes minimas e testadas.

---

## (A) RELATORIO DE ACHADOS PRIORIZADOS

### P0-01 | Edge Function `admin-delete-fiscal-issuer` sem autenticacao obrigatoria
- **Severidade**: P0 (Critica)
- **Onde**: `supabase/functions/admin-delete-fiscal-issuer/index.ts` + `supabase/config.toml` (verify_jwt=false)
- **Risco**: Qualquer pessoa pode chamar esta funcao sem token. Se nenhum token e enviado, o bloco `if (user)` e ignorado e a funcao executa a delecao com `service_role` sem verificar se o chamador e admin.
- **Causa raiz**: `verify_jwt = false` no config.toml e logica condicional `if (user)` que permite execucao sem autenticacao.
- **Correcao**: Mudar `verify_jwt = true` no config.toml E tornar a validacao de admin obrigatoria (nao condicional). Se nao houver token valido, retornar 401.
- **Teste**: Chamar a funcao sem token e verificar que retorna 401. Chamar com token de usuario nao-admin e verificar 403.
- **Validacao manual**: `curl -X POST .../admin-delete-fiscal-issuer -d '{"issuer_id":"fake"}' -H 'Content-Type: application/json' -H 'apikey: ...'` deve retornar 401.

### P0-02 | Edge Function `service-provider-spatial-matching` sem autenticacao
- **Severidade**: P0
- **Onde**: `supabase/functions/service-provider-spatial-matching/index.ts` + config.toml (verify_jwt=false)
- **Risco**: Funcao usa `service_role` diretamente e aceita chamadas sem autenticacao. Permite enumerar prestadores, suas localizacoes e areas de atuacao por qualquer pessoa.
- **Causa raiz**: `verify_jwt = false` e nenhuma validacao de token no codigo.
- **Correcao**: Adicionar validacao JWT in-code (padrao dual client: anon para auth, service_role para queries), ou mudar verify_jwt para true se todos os chamadores forem autenticados.
- **Teste**: Verificar que chamadas sem token retornam 401.

### P0-03 | Queries diretas em `profiles` (tabela crua com PII) em vez de `profiles_secure`
- **Severidade**: P0
- **Onde**: 83 arquivos usam `.from('profiles')` diretamente. Muitos sao para o proprio usuario (OK pela RLS), mas varios buscam dados de terceiros:
  - `src/components/NotificationCenter.tsx` (linhas 163-165, 181-183) — busca `full_name` de terceiros
  - `src/components/PendingServiceRatingsPanel.tsx` (linha 64) — busca perfis por `.in('id', allProfileIds)`
  - `src/components/ServiceHistory.tsx` (linhas 141-148) — busca clientes e prestadores
  - `src/hooks/useProposalChat.ts` (linha 46) — busca perfis de participantes do chat
  - `src/components/LoyaltyProgram.tsx` (linhas 60, 113) — busca perfil proprio (menor risco)
  - `src/components/SecurityCompleteProfile.tsx` (linhas 136, 150) — update do proprio perfil (OK)
- **Risco**: Column-Level Security (CLS) pode bloquear campos sensiveis (telefone, documento) quando a query e feita por outro usuario, causando erros silenciosos ou exposicao de PII.
- **Causa raiz**: Codigo legado que nao migrou para a view `profiles_secure`.
- **Correcao**: Migrar as queries de terceiros para `profiles_secure`. Manter queries do proprio perfil em `profiles` (protegido por RLS).
- **Teste**: Verificar que componentes afetados exibem nomes corretamente sem erros RLS.

### P0-04 | `SecurityCompleteProfile.tsx` permite auto-aprovacao de PRESTADOR_SERVICOS
- **Severidade**: P0
- **Onde**: `src/components/SecurityCompleteProfile.tsx` (linhas 148-152)
- **Risco**: Prestador de servicos pode se auto-aprovar atualizando `status: 'APPROVED'` diretamente quando `completionPercentage >= 100`. Isso bypassa a regra de negocio que exige aprovacao manual para PRESTADOR_SERVICOS.
- **Causa raiz**: Logica de auto-aprovacao no frontend sem verificacao de role.
- **Correcao**: Remover o bloco de auto-aprovacao para PRESTADOR_SERVICOS. Apenas PRODUTOR e TRANSPORTADORA devem ser auto-aprovados (via `AutomaticApprovalService`).
- **Teste**: Verificar que prestador de servicos permanece PENDING apos completar 100% do perfil.

### P0-05 | `innerHTML` com dados nao sanitizados em componentes de mapa
- **Severidade**: P0
- **Onde**: `src/components/FleetGPSTrackingMap.tsx`, `src/components/antifraude/AntifraudMapView.tsx`, `src/components/freight/MultiDriverMapMapLibre.tsx`
- **Risco**: Uso de `root.innerHTML` com dados potencialmente controlados pelo usuario (nomes de motoristas, status). Se algum campo contiver HTML malicioso, pode resultar em XSS.
- **Causa raiz**: Uso de `innerHTML` para criar markers customizados no MapLibre sem sanitizacao.
- **Correcao**: Sanitizar todos os dados interpolados antes de injetar no innerHTML usando `sanitizeHtml()` de `src/lib/validation.ts`, ou usar `textContent` para dados de texto.
- **Teste**: Inserir um nome com `<script>alert(1)</script>` e verificar que o script nao executa.

### P0-06 | RLS Policy "always true" detectada
- **Severidade**: P0
- **Onde**: Supabase linter detectou policies com `USING (true)` ou `WITH CHECK (true)` em operacoes INSERT/UPDATE/DELETE
- **Risco**: Politicas permissivas podem permitir que qualquer usuario autenticado insira/altere/delete dados em tabelas que deveriam ser restritas.
- **Causa raiz**: Policies criadas com condicao `true` para conveniencia durante desenvolvimento.
- **Correcao**: Identificar exatamente quais tabelas possuem `true` em INSERT/UPDATE/DELETE e restringir. As tabelas detectadas na query (`antt_price_sync_logs` com INSERT public, `driver_badges/driver_levels` com SELECT public) precisam revisao.
- **Teste**: Executar linter novamente apos correcao.

---

### P1-01 | Ausencia de `sanitizeForDisplay` centralizado para XSS em chat
- **Severidade**: P1
- **Onde**: Componentes de chat que renderizam mensagens de texto de outros usuarios
- **Risco**: Se um usuario enviar HTML em uma mensagem de chat, pode ser renderizado sem sanitizacao.
- **Causa raiz**: `sanitizeHtml` existe em `src/lib/validation.ts` mas nao e aplicada consistentemente em componentes de exibicao de mensagens.
- **Correcao**: Criar util `sanitizeForDisplaySafe()` que combina `sanitizeHtml` + `sanitizeInput` e aplicar em todos os pontos que renderizam texto de terceiros (chat, nomes, descricoes).
- **Teste**: Enviar mensagem com `<img src=x onerror=alert(1)>` e verificar neutralizacao.

### P1-02 | Edge Functions com `verify_jwt=false` que precisam revisao
- **Severidade**: P1
- **Onde**: `supabase/config.toml` — varias funcoes com verify_jwt=false
- **Risco**: Funcoes como `check-subscription`, `antt-freight-table`, `antt-calculator`, `calculate-route`, `service-pricing` aceitam chamadas sem autenticacao. Algumas sao legitimas (webhooks, cron jobs, funcoes publicas), outras precisam revisao.
- **Funcoes que necessitam revisao de seguranca interna**:
  - `service-provider-spatial-matching` (P0-02 acima — sem nenhuma auth)
  - `admin-delete-fiscal-issuer` (P0-01 acima — admin sem auth)
  - `test-focus-tokens` (funcao de teste em producao)
  - `auto-correct-invalid-roles` (modifica roles sem auth — deve ser cron-only)
- **Funcoes legitimamente sem JWT** (webhooks/cron): `payment-webhook`, `stripe-webhook`, `pagarme-webhook`, `report-error`, `send-auth-email`, `cte-polling`, `mdfe-polling`, funcoes de monitoramento/relatorio.
- **Correcao**: Para funcoes administrativas e de matching, adicionar validacao JWT in-code. Para funcoes de teste, remover de producao ou proteger com apikey custom.

### P1-03 | Coordenadas 0,0 nao validadas antes de persistencia
- **Severidade**: P1
- **Onde**: `src/components/ManualLocationTracking.tsx` e outros pontos que salvam coordenadas
- **Risco**: Salvar lat=0, lng=0 invalida historico de rotas e mapas.
- **Causa raiz**: Falta de validacao pre-persistencia.
- **Correcao**: Adicionar guard `isValidCoordinate(lat, lng)` que rejeita 0,0 e coordenadas fora do Brasil antes de persistir.
- **Teste**: Tentar salvar coordenada 0,0 e verificar que e rejeitada.

### P1-04 | `useBootstrapGuard` expoe SUPABASE_ANON_KEY hardcoded
- **Severidade**: P1 (info leakage)
- **Onde**: `src/hooks/useBootstrapGuard.ts` (linhas 40-41)
- **Risco**: A anon key ja e publica (esta no `.env` e no bundle), mas hardcoda-la em outro arquivo cria duplicacao. Se a key mudar, este arquivo ficara desatualizado.
- **Causa raiz**: Copia direta em vez de importar do client compartilhado.
- **Correcao**: Importar a URL e key de `src/integrations/supabase/client.ts` ou usar `import.meta.env.VITE_SUPABASE_*`.
- **Teste**: Verificar que bootstrap timeout alert ainda funciona apos mudanca.

---

## (B) CORRECOES A APLICAR

### Arquivos a modificar:

1. **`supabase/config.toml`** — Mudar `admin-delete-fiscal-issuer` para `verify_jwt = true`
2. **`supabase/functions/admin-delete-fiscal-issuer/index.ts`** — Tornar validacao admin obrigatoria (nao condicional)
3. **`supabase/functions/service-provider-spatial-matching/index.ts`** — Adicionar validacao JWT in-code
4. **`src/components/SecurityCompleteProfile.tsx`** — Remover auto-aprovacao para PRESTADOR_SERVICOS
5. **`src/components/NotificationCenter.tsx`** — Migrar queries de `profiles` para `profiles_secure`
6. **`src/components/PendingServiceRatingsPanel.tsx`** — Migrar para `profiles_secure`
7. **`src/components/ServiceHistory.tsx`** — Migrar para `profiles_secure`
8. **`src/hooks/useProposalChat.ts`** — Migrar para `profiles_secure`
9. **`src/components/FleetGPSTrackingMap.tsx`** — Sanitizar dados em innerHTML
10. **`src/components/antifraude/AntifraudMapView.tsx`** — Sanitizar dados em innerHTML
11. **`src/components/freight/MultiDriverMapMapLibre.tsx`** — Sanitizar dados em innerHTML
12. **`src/hooks/useBootstrapGuard.ts`** — Usar env vars em vez de hardcoded keys
13. **`src/lib/validation.ts`** — Adicionar `sanitizeForDisplaySafe()` e `isValidCoordinate()`

### Migracoes SQL: Nenhuma necessaria.

---

## (C) TESTES A ADICIONAR

1. **`src/security/__tests__/edgeFunctionAuth.test.ts`** — Testar que funcoes admin requerem autenticacao
2. **`src/security/__tests__/sanitization.test.ts`** — Testar sanitizacao de XSS em innerHTML e campos de texto
3. **`src/security/__tests__/profileSecureUsage.test.ts`** — Testar que queries de terceiros usam profiles_secure
4. **`src/security/__tests__/coordinateValidation.test.ts`** — Testar rejeicao de coordenadas invalidas
5. **`src/security/__tests__/roleApproval.test.ts`** — Testar que PRESTADOR_SERVICOS nao pode se auto-aprovar

---

## (D) CHECKLIST FINAL iOS/Android

### Permissoes e Strings (PT-BR)
- [OK] `NSCameraUsageDescription` — PT-BR correto
- [OK] `NSPhotoLibraryUsageDescription` — PT-BR correto
- [OK] `NSLocationWhenInUseUsageDescription` — PT-BR correto
- [OK] `NSLocationAlwaysUsageDescription` — presente

### ATT (App Tracking Transparency)
- [OK] O app NAO rastreia usuarios para fins publicitarios
- [OK] `ITSAppUsesNonExemptEncryption = false` (apenas HTTPS/TLS padrao)
- [OK] `NSUserTrackingUsageDescription` removido (nao aplica)
- **Acao para App Store Connect**: No formulario de privacidade, marcar "No" para todas as categorias de tracking. Dados coletados: localizacao (para funcionalidade do app, nao tracking), fotos (verificacao de identidade).

### Localizacao e Background
- [OK] Capacitor Geolocation com fallback robusto
- [OK] Cooldown de notificacoes GPS (2 min)
- [OK] Validacao de permissao com fallback getCurrentPosition

### Navegacao e Guards por Role
- [OK] 3 camadas: ProtectedRoute + RequirePanel + useRoleGate
- [OK] panelAccessGuard como fonte unica de verdade
- [OK] Bloqueio de status PENDING/REJECTED com tela dedicada
- [OK] Redirecionamento deterministico por role

### Historico/Relatorios
- [OK] Tabelas de historico imutaveis (sem INSERT/UPDATE para usuarios)
- [OK] Triggers SECURITY DEFINER para persistencia
- [OK] Snapshot de conclusao via RPC

### Seguranca de Workflow
- [OK] freightWorkflowGuard com progressao linear
- [OK] serviceRequestWorkflowGuard com progressao linear
- [OK] Testes existentes cobrindo regressoes e saltos de status
- [OK] i18nGuard garantindo PT-BR em toda a UI

### ServiceWorker/Capacitor
- [OK] ServiceWorker desabilitado em Capacitor/nativo
- [OK] Deteccao isCapacitorApp no main.tsx

---

## RESUMO DE PRIORIDADES

| ID | Severidade | Achado | Status |
|---|---|---|---|
| P0-01 | CRITICA | admin-delete-fiscal-issuer sem auth | A corrigir |
| P0-02 | CRITICA | service-provider-spatial-matching sem auth | A corrigir |
| P0-03 | ALTA | Queries em profiles (PII) sem profiles_secure | A corrigir |
| P0-04 | ALTA | Auto-aprovacao indevida de PRESTADOR_SERVICOS | A corrigir |
| P0-05 | ALTA | innerHTML sem sanitizacao em mapas | A corrigir |
| P0-06 | MEDIA | RLS policies com true (INSERT/public) | A revisar |
| P1-01 | MEDIA | XSS em chat sem sanitizacao centralizada | A corrigir |
| P1-02 | MEDIA | Edge Functions verify_jwt revisao | A revisar |
| P1-03 | BAIXA | Coordenadas 0,0 sem validacao | A corrigir |
| P1-04 | BAIXA | Anon key hardcoded em useBootstrapGuard | A corrigir |

Total: 10 achados, 7 correcoes de codigo, 0 migracoes SQL, 5 arquivos de teste novos.
