

# Plano de Correção Pre-Build Android: Bug Critico de Segurança + Estabilidade

## Problema Critico Encontrado (P0 - Bloqueador de Build)

A migração de segurança aplicada recentemente (`20260212145342`) executou `REVOKE SELECT` em ~24 colunas PII da tabela `profiles` para os roles `anon` e `authenticated`. No entanto, o hook principal de autenticação (`useAuth.ts`) ainda seleciona essas colunas revogadas diretamente da tabela `profiles`.

**Impacto:** No PostgreSQL, `REVOKE SELECT` em colunas e absoluto e sobrescreve politicas RLS. Isso significa que **nem o proprio usuario logado** consegue ler essas colunas da tabela `profiles`. O resultado e que `useAuth.ts` falha silenciosamente ou retorna erro, quebrando todo o fluxo de autenticação -- login, dashboard, e qualquer funcionalidade que dependa de `profile`.

### Colunas revogadas que `useAuth.ts` (linha 198-215) ainda tenta selecionar:

- `cpf_cnpj`, `rntrc`, `antt_number`
- `phone`, `contact_phone`
- `document`
- `emergency_contact_name`, `emergency_contact_phone`
- `farm_address`
- `selfie_url`, `document_photo_url`, `cnh_photo_url`
- `truck_documents_url`, `license_plate_photo_url`, `address_proof_url`

### Segundo arquivo afetado:

`src/hooks/useAffiliatedDriverProfile.ts` (linhas 77-107, fallback) seleciona colunas revogadas diretamente da tabela `profiles`.

---

## Solução

### Etapa 1: Corrigir `useAuth.ts` -- Usar `profiles_secure` view OU remover colunas revogadas

A view `profiles_secure` ja existe e faz mascaramento condicional via `CASE WHEN p.user_id = auth.uid()`. Para o usuario logado, ela retorna os dados reais. Para terceiros, retorna `NULL` ou `***`.

**Abordagem:** Trocar a query do `fetchProfile` em `useAuth.ts` para usar `profiles_secure` ao inves de `profiles`, selecionando apenas as colunas que essa view expoe. As colunas que a view nao expoe (como `document_photo_url`, `cnh_photo_url`, `truck_documents_url`, etc.) precisam ser buscadas de outra forma ou removidas do select inicial do auth.

**Alternativa mais simples (recomendada):** Remover da query do `useAuth.ts` todas as colunas que foram revogadas e que nao sao essenciais para o boot do app. O perfil do auth precisa basicamente de: `id`, `user_id`, `full_name`, `role`, `status`, `active_mode`, `service_types`, `base_city_name`, `base_state`, `rating`, `selfie_url`. Colunas PII (`cpf_cnpj`, `phone`, etc.) e documentos podem ser carregados sob demanda quando o usuario acessa a pagina de perfil/configuracoes, usando a view `profiles_secure`.

Colunas a **manter** no select de `useAuth.ts` (disponíveis após GRANT):
```
id, user_id, full_name, role, status, active_mode, service_types,
base_city_name, base_state, base_city_id, base_lat, base_lng,
current_city_name, current_state, created_at, updated_at,
cooperative, rating, cnh_expiry_date, cnh_category,
document_validation_status, cnh_validation_status,
rntrc_validation_status, validation_notes,
background_check_status, rating_locked,
last_gps_update, current_location_lat, current_location_lng,
selfie_url, location_enabled, farm_name
```

Colunas a **remover** do select (revogadas):
```
phone, document, cpf_cnpj, rntrc, antt_number,
emergency_contact_name, emergency_contact_phone,
contact_phone, farm_address,
document_photo_url, cnh_photo_url,
truck_documents_url, truck_photo_url,
license_plate_photo_url, address_proof_url
```

**Nota:** `truck_photo_url` nao aparece na lista de REVOKE, precisa verificar se foi incluido. Olhando a migracao: nao esta na lista de REVOKE nem de GRANT -- pode causar erro tambem. Sera tratado.

### Etapa 2: Atualizar a interface `UserProfile` em `useAuth.ts`

Marcar como opcionais os campos removidos do select, e adicionar comentario explicando que devem ser buscados via `profiles_secure` quando necessarios.

### Etapa 3: Corrigir `useAffiliatedDriverProfile.ts` fallback

Remover colunas revogadas do fallback select (linhas 79-105) ou redirecionar para `profiles_secure`.

### Etapa 4: Verificar outros arquivos

- `DriverDocumentRequestTab.tsx` usa `profiles_secure` (correto)
- `useProfileCached.ts` ja foi corrigido anteriormente (correto)
- `FleetGPSTrackingMap.tsx` usa `profiles_secure` (correto)
- Demais hooks que consultam `profiles` selecionam apenas colunas permitidas (`id`, `full_name`, `rating`, etc.)

---

## Checklist de Entrega

| Area | Status | Acao |
|------|--------|------|
| Build/Typecheck | Verificar apos correcao | Corrigir tipos que referenciam campos removidos |
| Auth (`useAuth.ts`) | CRITICO | Remover colunas revogadas do SELECT |
| Affiliated Driver | MEDIO | Corrigir fallback SELECT |
| Perfil em cache | OK | Ja corrigido anteriormente |
| Workflow guards | OK | Nao consultam `profiles` |
| MapLibre | OK | Hooks de estabilidade existentes |
| Reports | OK | Usa RPC, nao profiles direto |
| Polling/Refresh | OK | `useControlledRefresh` implementado |
| Android/Capacitor | OK | Config de producao correta |

---

## Detalhes Tecnicos da Correcao

### Arquivo 1: `src/hooks/useAuth.ts`

**Antes (linhas 198-215):**
```typescript
.select(`
  id, user_id, full_name, phone, document, role,
  status, active_mode, service_types,
  base_city_name, base_state, base_city_id,
  created_at, updated_at, cpf_cnpj, rntrc,
  antt_number, cooperative, rating,
  cnh_expiry_date, cnh_category,
  document_validation_status, cnh_validation_status,
  rntrc_validation_status, validation_notes,
  emergency_contact_name, emergency_contact_phone,
  background_check_status, rating_locked,
  last_gps_update, current_location_lat, current_location_lng,
  base_lat, base_lng, current_city_name, current_state,
  selfie_url, document_photo_url, cnh_photo_url,
  truck_documents_url, truck_photo_url,
  license_plate_photo_url, address_proof_url,
  contact_phone, location_enabled, farm_name, farm_address
`)
```

**Depois:**
```typescript
.select(`
  id, user_id, full_name, role,
  status, active_mode, service_types,
  base_city_name, base_state, base_city_id,
  created_at, updated_at,
  cooperative, rating,
  cnh_expiry_date, cnh_category,
  document_validation_status, cnh_validation_status,
  rntrc_validation_status, validation_notes,
  background_check_status, rating_locked,
  last_gps_update, current_location_lat, current_location_lng,
  base_lat, base_lng, current_city_name, current_state,
  selfie_url, location_enabled, farm_name
`)
```

Apos isso, uma segunda query via `profiles_secure` sera adicionada para buscar PII do proprio usuario quando necessario (lazy load).

### Arquivo 2: `src/hooks/useAffiliatedDriverProfile.ts`

Trocar o fallback (linhas 77-107) para usar `profiles_secure` ao inves de `profiles` direto.

---

## Riscos Restantes

1. **Componentes que leem `profile.phone`, `profile.cpf_cnpj` etc do `useAuth()`**: Esses campos virao como `undefined` apos a correcao. Componentes que exibem esses dados precisam buscar via `profiles_secure`. Isso e um trade-off aceito -- PII nao deve estar no state global de auth.

2. **Leaked Password Protection**: Configuracao manual no Supabase Dashboard. Nao pode ser corrigida via codigo.

## Smoke Test Android (10 min)

1. Abrir app -- splash screen carrega, sem tela branca
2. Login com cada role -- dashboard aparece corretamente
3. Verificar que nenhum erro no console sobre colunas revogadas
4. Abrir modal de frete -- abre/fecha sem travar
5. Navegar entre abas -- sem spam de rede em idle
6. Abrir mapa -- tiles carregam
7. Verificar textos em PT-BR
8. Botao voltar do Android funciona
9. Verificar historico e relatorios
10. Logout funciona e redireciona

