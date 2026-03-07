# 🐛 AgriRoute — Registro de Bugs Conhecidos e Correções

> **Última atualização:** 07/03/2026  
> **Objetivo:** Documentar todos os bugs encontrados e corrigidos para evitar regressões.

---

## Índice de Severidade

| Emoji | Nível | Descrição |
|-------|-------|-----------|
| 🔴 | CRITICAL | Bloqueia funcionalidade principal |
| 🟠 | HIGH | Impacto significativo na UX ou segurança |
| 🟡 | MEDIUM | Funcionalidade parcialmente afetada |
| 🟢 | LOW | Cosmético ou edge case |

---

## Bugs Corrigidos

### BUG-001 🔴 RLS: dynamic_credit_limits sem políticas INSERT/UPDATE
- **Data:** 07/03/2026
- **Erro:** `42501 — new row violates row-level security policy for dynamic_credit_limits`
- **Rota:** `/dashboard/driver`
- **Causa raiz:** Tabela `dynamic_credit_limits` tinha RLS habilitado mas sem políticas de INSERT/UPDATE para `authenticated`.
- **Correção:** Migração adicionando políticas SELECT, INSERT, UPDATE com escopo `profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())`.
- **Arquivo:** `supabase/migrations/20260307130330_*.sql`
- **Prevenção:** Toda nova tabela com RLS DEVE ter políticas explícitas para todas as operações necessárias.

---

### BUG-002 🟠 Proposta duplicada: unique constraint violation
- **Data:** 07/03/2026
- **Erro:** `23505 — duplicate key value violates unique constraint`
- **Rota:** `/dashboard/driver` (envio de proposta)
- **Causa raiz:** Usuário clicava "Enviar" duas vezes ou reenviava proposta para mesmo frete. O código não tratava o erro `23505` de forma amigável.
- **Correção:** Tratamento de erro `23505` nos modais de proposta com mensagem "Proposta já enviada" em vez de erro genérico.
- **Arquivos:** `src/components/ProposalModal.tsx`, `src/components/FlexibleProposalModal.tsx`, `src/components/ServiceProposalModal.tsx`
- **Prevenção:** Sempre tratar `23505` com mensagem amigável ao usuário.

---

### BUG-003 🔴 Auth Modal — Tela preta / Loop infinito em produção
- **Data:** ~03/2026
- **Erro:** Modal de autenticação causava tela preta no domínio `agriroute-connect.com.br` devido a conflitos de Portal/DOM.
- **Causa raiz:** `createPortal` do React injetava modal em nó DOM incorreto em produção.
- **Correção:** `SafeAuthModal` detecta domínio de produção e usa renderização inline (sem Portal). Verificação DOM com `data-auth-modal-content`.
- **Arquivo:** `src/components/SafeAuthModal.tsx`
- **Prevenção:** Em domínios de produção, evitar `createPortal` para modais críticos.

---

### BUG-004 🟠 Landing — Botão "Cadastrar-se" sumia / Loop infinito
- **Data:** ~03/2026
- **Erro:** Botão de cadastro na Landing Page desaparecia; abrir modal de auth causava loop.
- **Causa raiz:** Estado `authModal` era manipulado incorretamente, gerando re-renders infinitos.
- **Correção:** Removido modal de auth da Landing; cadastro redireciona para `/auth` diretamente. `MobileMenu` recriado com `onSignupClick`.
- **Arquivos:** `src/pages/Landing.tsx`, `src/components/MobileMenu.tsx`
- **Prevenção:** Não usar estado de modal complexo na Landing; preferir navegação direta.

---

### BUG-005 🟡 Cards de Dashboard — Contagens misturando fretes e serviços
- **Data:** ~03/2026
- **Erro:** Card "Abertos" no dashboard do produtor somava fretes + serviços, mostrando contagem inflada.
- **Causa raiz:** Query não separava fretes rurais/urbanos de service_requests.
- **Correção:** Classificação centralizada via `src/lib/item-classification.ts`. Card "Abertos" mostra apenas fretes; card "Serviços" mostra serviços.
- **Arquivos:** `src/lib/item-classification.ts`, `src/pages/producer/ProducerDashboardStats.tsx`, `src/pages/ProducerDashboard.tsx`
- **Prevenção:** Usar SEMPRE `item-classification.ts` para separar tipos.

---

### BUG-006 🟡 Toasts automáticos em erros de carregamento
- **Data:** ~03/2026
- **Erro:** Toast de erro aparecia automaticamente ao carregar pagamentos, mesmo quando o usuário não interagiu.
- **Causa raiz:** `useServicePayments` fazia fetch automático no mount e propagava erros como toast.
- **Correção:** Removido fetch automático; erros são silenciosos (sem toast) durante carregamento background.
- **Arquivo:** `src/hooks/useServicePayments.ts`
- **Prevenção:** Erros de fetch automático NUNCA devem gerar toast. Toasts só em ações do usuário.

---

### BUG-007 🟠 Device Registration — RLS failure em transição de sessão
- **Data:** ~03/2026
- **Erro:** `42501` ao registrar dispositivo durante login/logout.
- **Causa raiz:** Sessão ainda não estava completamente estabelecida quando `useDeviceRegistration` tentava INSERT.
- **Correção:** Tratamento silencioso de `42501` com retry. Erros `23505` (dispositivo já registrado) geram novo ID. Sem reportar ao monitoring.
- **Arquivos:** `src/hooks/useDeviceRegistration.ts`, `src/services/deviceService.ts`
- **Prevenção:** Operações de device registration devem ter retry com backoff.

---

### BUG-008 🟠 Transportadora — Aprovar/Rejeitar motorista sem permissão
- **Data:** ~03/2026
- **Erro:** `42501` ao aprovar ou rejeitar motorista vinculado.
- **Causa raiz:** Política RLS não cobria caso do admin da transportadora.
- **Correção:** Mensagens de erro específicas para `42501` ("Sem permissão para aprovar/rejeitar").
- **Arquivo:** `src/hooks/useTransportCompany.ts`
- **Prevenção:** Validar permissão de admin antes de chamar mutação.

---

### BUG-009 🟡 Avaliação duplicada — Rating submit
- **Data:** ~03/2026
- **Erro:** Usuário conseguia submeter avaliação duas vezes causando erro de unique constraint.
- **Causa raiz:** Sem debounce ou verificação prévia de avaliação existente.
- **Correção:** Tratamento de `duplicate key` com mensagem "Avaliação já registrada".
- **Arquivo:** `src/hooks/useRatingSubmit.ts`
- **Prevenção:** Verificar existência antes de INSERT ou tratar `23505`.

---

### BUG-010 🟠 Compartilhar frete — Atribuição duplicada
- **Data:** ~03/2026
- **Erro:** `23505` ao compartilhar frete com motorista já atribuído.
- **Causa raiz:** Sem verificação prévia de atribuição existente.
- **Correção:** Tratamento específico de `23505` com toast amigável ("Este motorista já está atribuído").
- **Arquivo:** `src/components/ShareFreightToDriver.tsx`
- **Prevenção:** Tratar duplicate key em toda operação de atribuição.

---

### BUG-011 🟡 Cidades duplicadas no seletor
- **Data:** ~03/2026
- **Erro:** Mesmo município aparecia múltiplas vezes no seletor de cidades.
- **Causa raiz:** Registros duplicados na tabela `cities` com `ibge_code` diferentes (um null, outro com valor).
- **Correção:** Deduplicação por nome+UF (não por ibge_code). Scoring de qualidade para manter o registro mais completo.
- **Arquivo:** `src/utils/city-deduplication.ts`
- **Prevenção:** Chave de dedupe SEMPRE é `nome_normalizado + UF`.

---

### BUG-012 🟠 FreightHistory — Fretes urbanos não apareciam para produtor
- **Data:** ~03/2026
- **Erro:** Histórico do produtor não mostrava fretes urbanos (FRETE_MOTO, GUINCHO, MUDANÇA).
- **Causa raiz:** Query de histórico filtrava apenas por tipos rurais.
- **Correção:** Busca de fretes urbanos para TODOS os roles usando `getFreightTypesForQuery()`.
- **Arquivo:** `src/components/FreightHistory.tsx`
- **Prevenção:** Usar classificação centralizada para queries de fretes.

---

### BUG-013 🟠 Confirmação de entrega — Não suportava multi-carreta
- **Data:** ~03/2026
- **Erro:** Confirmação de entrega confirmava o frete inteiro em vez de carretas individuais.
- **Causa raiz:** Lógica de confirmação não considerava atribuições individuais (freight_assignments).
- **Correção:** Hook dedicado para confirmações individuais com suporte a multi-carreta.
- **Arquivo:** `src/pages/ProducerDashboard.tsx`
- **Prevenção:** Toda lógica de confirmação deve considerar assignments individuais.

---

### BUG-014 🟠 Duplicate key em React — Listas com IDs repetidos
- **Data:** ~03/2026
- **Erro:** Warning do React "duplicate key" em listas de fretes e chats.
- **Causa raiz:** RPCs retornavam itens duplicados (joins múltiplos).
- **Correção:** Deduplicação via `Map` por ID antes de renderizar.
- **Arquivos:** `src/hooks/useUnifiedChats.ts`, `src/components/CompanySmartFreightMatcher.tsx`
- **Prevenção:** Sempre deduplicar resultados de RPCs antes de renderizar listas.

---

### BUG-015 🔴 RLS — Subconsulta direta a profiles causava 42501
- **Data:** ~03/2026
- **Erro:** `42501` em tabelas dependentes (freights, driver_current_locations) durante transições de sessão.
- **Causa raiz:** Políticas RLS faziam subconsulta direta à tabela `profiles`, que tinha política restritiva.
- **Correção:** Padrão arquitetural: usar `get_my_profile_id()` (SECURITY DEFINER) em vez de subconsulta direta.
- **Prevenção:** NUNCA fazer subconsulta direta a `profiles` em políticas RLS. Usar `get_my_profile_id()`.
- **Documentado em:** Memory `security/rls-subquery-bypass-standard`

---

### BUG-016 🟠 Edge Function — processar-cadastro-motorista sem rate limiting
- **Data:** 04/03/2026
- **Erro:** Endpoint público sem proteção contra abuso.
- **Causa raiz:** Faltava validação de input e rate limiting.
- **Correção:** Rate limiting (3/min por IP), Zod validation, CORS headers, mensagens genéricas.
- **Arquivo:** `supabase/functions/processar-cadastro-motorista/index.ts`
- **Prevenção:** Todo endpoint público DEVE ter rate limiting e validação Zod.

---

### BUG-017 🟠 Edge Function — delete-user-account com auth frágil
- **Data:** 04/03/2026
- **Erro:** Função usava `getUser()` que não era compatível com signing-keys.
- **Causa raiz:** Padrão antigo de validação de JWT.
- **Correção:** Migrado para `getClaims()`, usando anon key em vez de service_role para auth.
- **Arquivo:** `supabase/functions/delete-user-account/index.ts`
- **Prevenção:** Funções autenticadas devem usar padrão compatível com signing-keys.

---

### BUG-018 🟡 Funções PostgreSQL — search_path mutável
- **Data:** 06/03/2026
- **Erro:** Funções SECURITY DEFINER sem `SET search_path` eram vulneráveis a hijacking.
- **Causa raiz:** `update_updated_at_column` e outras funções não definiam search_path fixo.
- **Correção:** Migração adicionando `SET search_path = public` a funções SECURITY DEFINER.
- **Prevenção:** Toda função SECURITY DEFINER DEVE ter `SET search_path = public`.
- **Documentado em:** Memory `security/database-functions-access-control`

---

### BUG-019 🟠 Funções PostgreSQL — EXECUTE exposto para PUBLIC/anon
- **Data:** ~03/2026
- **Erro:** Roles `PUBLIC` e `anon` podiam executar funções SECURITY DEFINER.
- **Causa raiz:** PostgreSQL concede EXECUTE a PUBLIC por padrão.
- **Correção:** `REVOKE EXECUTE FROM PUBLIC, anon` em funções SECURITY DEFINER. GRANT explícito para `authenticated`.
- **Prevenção:** Toda função SECURITY DEFINER deve revogar EXECUTE de PUBLIC e anon.
- **Documentado em:** Memory `security/database-functions-access-control`

---

### BUG-020 🟡 Storage bucket público — service-chat-images
- **Data:** ~01/2026 → Corrigido ~03/2026
- **Erro:** Bucket `service-chat-images` estava público (`public=true`).
- **Causa raiz:** Migração original criou bucket como público.
- **Correção:** Bucket alterado para privado. Acesso via signed URLs (`useSignedImageUrl`).
- **Prevenção:** Buckets NUNCA devem ser públicos. Usar signed URLs.

---

### BUG-021 🟡 Criptografia — Chave hardcoded em migração
- **Data:** ~09/2025 → Mitigado ~03/2026
- **Erro:** Chave `agri_key_2024` hardcoded como default em função de criptografia.
- **Causa raiz:** Implementação inicial usava default parameter.
- **Correção:** Funções atuais buscam chave da tabela `encryption_keys` via SECURITY DEFINER. Default removido.
- **Prevenção:** Chaves de criptografia NUNCA como parâmetro default. Buscar de vault/tabela segura.

---

### BUG-022 🟠 FRETE_MOTO — Ações de cancelar/editar não funcionavam para produtor
- **Data:** ~03/2026
- **Erro:** Produtor não conseguia cancelar ou editar fretes do tipo FRETE_MOTO.
- **Causa raiz:** Handler de ações não cobria service_requests (FRETE_MOTO usa tabela diferente).
- **Correção:** Handler dedicado `handleMotoFreightAction` para ações em service_requests.
- **Arquivo:** `src/pages/ProducerDashboard.tsx`
- **Prevenção:** Todo novo tipo de frete deve ter handlers de ação validados.

---

### BUG-023 🟡 FeedIntegrityGuard — backendEligible > backendDisplayed
- **Data:** Recorrente
- **Erro:** Warning no console: mais fretes elegíveis que exibidos.
- **Causa raiz:** Filtro de cidade no client-side remove fretes fora da área de atuação do motorista.
- **Status:** ⚠️ Comportamento esperado (não é bug). Guard apenas alerta para investigação.
- **Prevenção:** Guard é ferramenta de monitoramento. Warning é normal quando filtro de cidade está ativo.

---

## Padrões de Prevenção (Checklist)

### Antes de criar tabelas com RLS:
- [ ] Definir políticas para SELECT, INSERT, UPDATE, DELETE conforme necessário
- [ ] Usar `get_my_profile_id()` em vez de subconsulta a `profiles`
- [ ] Testar com usuário autenticado e anônimo

### Antes de criar funções SECURITY DEFINER:
- [ ] Adicionar `SET search_path = public`
- [ ] `REVOKE EXECUTE FROM PUBLIC, anon`
- [ ] `GRANT EXECUTE TO authenticated` (se necessário)

### Antes de criar endpoints públicos:
- [ ] Rate limiting por IP
- [ ] Validação Zod para todos os inputs
- [ ] Sanitização XSS (stripHtml)
- [ ] Mensagens de erro genéricas (sem detalhes internos)

### Em mutations de INSERT:
- [ ] Tratar erro `23505` (duplicate key) com mensagem amigável
- [ ] Tratar erro `42501` (RLS) com mensagem de permissão
- [ ] Desabilitar botão após primeiro clique (anti-double-submit)

### Em queries de listagem:
- [ ] Deduplicar resultados antes de renderizar (Map por ID)
- [ ] Usar classificação centralizada (item-classification.ts)
- [ ] Considerar limite de 1000 rows do Supabase

---

## Como Adicionar Novos Bugs

```markdown
### BUG-NNN 🔴/🟠/🟡/🟢 Título curto
- **Data:** DD/MM/AAAA
- **Erro:** Mensagem de erro ou comportamento observado
- **Rota:** Rota afetada
- **Causa raiz:** Por que aconteceu
- **Correção:** O que foi feito
- **Arquivo(s):** Arquivo(s) alterado(s)
- **Prevenção:** Como evitar no futuro
```
