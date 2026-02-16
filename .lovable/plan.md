

## Verificacao Completa: Impacto da Migracao de Buckets Privados

### Buckets Migrados para Privado
- `chat-images` -- PRIVADO
- `proposal-chat-images` -- PRIVADO
- `proposal-chat-files` -- PRIVADO
- `service-chat-images` -- PRIVADO
- `mdfe-dactes` -- PRIVADO

### Status: O que foi corrigido corretamente

| Arquivo | Bucket | Status |
|---------|--------|--------|
| `src/hooks/useProposalChat.ts` | proposal-chat-images, proposal-chat-files | OK - Usa `createSignedUrl` |
| `src/components/DocumentRequestChat.tsx` | chat-images | OK - Usa `createSignedUrl` |
| `src/components/chat/ChatInput.tsx` | chat-images, chat-files | OK - Usa `createSignedUrl` |
| `src/hooks/useManifesto.ts` | mdfe-dactes | OK - Usa `createSignedUrl` |
| `src/hooks/useServiceChatConnection.ts` | (dinamico) | OK - Usa `resolveStorageUrl` com signed URLs |
| `src/hooks/useFreightChatConnection.ts` | (dinamico) | OK - Usa `resolveStorageUrl` com signed URLs |
| `src/components/proposal/ProposalChatPanel.tsx` | (dinamico) | OK - Usa `SignedStorageImage` + signed download |
| `src/components/ui/signed-storage-image.tsx` | (dinamico) | OK - Componente com renovacao automatica |
| `src/components/ui/storage-image.tsx` | (dinamico) | OK - Fallback para signed URL on error |
| `src/hooks/useSignedImageUrl.ts` | (dinamico) | OK - Hook com deteccao de expiracao |

### PROBLEMAS ENCONTRADOS -- Arquivos que ainda usam `getPublicUrl` em buckets PRIVADOS

#### 1. `src/components/FreightCheckinModal.tsx` (CRITICO)
- **Bucket**: `freight-checkins` (PRIVADO)
- **Linha 116-118**: Usa `getPublicUrl` apos upload
- **Impacto**: URLs de fotos de check-in salvas no banco serao inacessiveis. O upload funciona, mas a URL gerada retornara erro 400/403 ao tentar visualizar.
- **Correcao**: Substituir `getPublicUrl` por `createSignedUrl` e salvar o path relativo (nao a URL) no banco para permitir re-geracao de signed URLs na exibicao.

#### 2. `src/components/freight/FreightAttachments.tsx` (CRITICO)
- **Bucket**: `freight-attachments` (PRIVADO)
- **Linha 184-187**: Usa `getPublicUrl` apos upload
- **Impacto**: Anexos de frete serao enviados mas URLs inacessiveis. O fallback `URL.createObjectURL` na linha 197 funciona apenas na sessao atual do browser.
- **Correcao**: Substituir `getPublicUrl` por `createSignedUrl`, e nos componentes de exibicao, gerar signed URLs frescas ao abrir/baixar.

#### 3. `src/utils/authUploadHelper.ts` (MEDIO)
- **Bucket**: Generico (usado por `ProfilePhotoUpload` com `profile-photos` e `DocumentUpload` com buckets variados)
- **Linha 83**: Usa `getPublicUrl` para qualquer bucket
- **Impacto para buckets privados**: Se esse helper for chamado com um bucket privado (`driver-documents`, `identity-selfies`), a URL retornada sera inacessivel.
- **Impacto atual real**: `profile-photos` ainda e PUBLICO, entao `ProfilePhotoUpload` funciona. `DocumentUpload` usa `driver-documents` que e PRIVADO - problema real.
- **Correcao**: Alterar o helper para tentar `createSignedUrl` e retornar `{ signedUrl }` ou `{ publicUrl }` dependendo do bucket.

#### 4. `src/components/driver-details/DriverInfoTab.tsx` (CRITICO)
- **Bucket**: `driver-documents` (PRIVADO)
- **Linha 106-108**: Usa `getPublicUrl` para fotos de perfil e documentos de motoristas
- **Impacto**: Upload de documentos funciona mas URLs salvas no banco serao inacessiveis.
- **Correcao**: Substituir por `createSignedUrl` ou salvar apenas o path relativo.

#### 5. `src/components/vehicle/VehiclePhotoGallery.tsx` (CRITICO)
- **Bucket**: `driver-documents` (PRIVADO)
- **Linha 67-69**: Usa `getPublicUrl` para fotos de veiculos
- **Impacto**: Fotos de veiculos salvas com URLs publicas que nao funcionam.
- **Nota**: O componente de exibicao ja usa `StorageImage` que tenta signed URL como fallback - entao a EXIBICAO pode funcionar, mas e ineficiente (tenta public, falha, tenta signed).
- **Correcao**: Substituir `getPublicUrl` por `createSignedUrl` no upload.

#### 6. `src/pages/AffiliatedDriverSignup.tsx` (MEDIO)
- **Bucket**: `profile-photos` (PUBLICO -- sem problema atual)
- **Linha 411-413**: Usa `getPublicUrl`
- **Status**: OK por enquanto, pois `profile-photos` ainda e publico. Mas se futuramente for tornado privado, quebrara.

#### 7. `src/components/UserProfileModal.tsx` (MEDIO)
- **Bucket**: `profile-photos` (PUBLICO -- sem problema atual)
- **Status**: OK por enquanto.

### Politicas RLS dos Buckets -- Verificacao

Todas as politicas SELECT para os buckets migrados estao corretas:
- Restritas a `authenticated` 
- Politicas de INSERT existentes mantidas
- Politicas de DELETE para o dono mantidas

**Problema potencial**: Nao encontrei politicas INSERT para `chat-images`, `proposal-chat-images`, `proposal-chat-files`. Preciso verificar se existem.

### Dados Existentes no Banco

- `proposal_chat_messages`: Nenhuma mensagem com imagem/arquivo encontrada (sem dados de teste afetados)
- `service-chat-images`: 1 arquivo existente -- acessivel via signed URL pois a politica SELECT autenticada existe

### Plano de Correcao (5 arquivos)

**1. `src/components/FreightCheckinModal.tsx`**
- Substituir `getPublicUrl` por `createSignedUrl(fileName, 86400)` (24h)
- As fotos de check-in sao usadas pontualmente, nao exibidas em listas

**2. `src/components/freight/FreightAttachments.tsx`**
- Substituir `getPublicUrl` por `createSignedUrl(fileName, 86400)`
- Atualizar a exibicao de anexos para usar `StorageImage` ou gerar signed URLs

**3. `src/utils/authUploadHelper.ts`**
- Alterar para usar `createSignedUrl` em vez de `getPublicUrl`
- Renomear retorno de `publicUrl` para `url` (ou manter compatibilidade)

**4. `src/components/driver-details/DriverInfoTab.tsx`**
- Substituir `getPublicUrl` por `createSignedUrl`

**5. `src/components/vehicle/VehiclePhotoGallery.tsx`**
- Substituir `getPublicUrl` por `createSignedUrl`

**6. Verificar e criar politicas INSERT faltantes** (se necessario, via migracao SQL)

### Arquivos que NAO precisam de alteracao
- `AffiliatedDriverSignup.tsx` -- bucket `profile-photos` e publico
- `UserProfileModal.tsx` -- bucket `profile-photos` e publico
- `GtaUploadDialog.tsx` -- bucket `documents` nao existe no storage (verificado)
- `NfaAssistedWizard.tsx` -- bucket `documents` nao existe no storage

