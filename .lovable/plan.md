

## Redesign da Edição de Perfil — Estilo Meta (Instagram/Facebook)

### Problema Atual
O modal de perfil atual (`UserProfileModal`) usa um layout de cards separados dentro de um Dialog, que fica confuso no mobile. A troca de foto é problemática, os campos estão espalhados e a experiência não é fluida. Toda a lógica de estado, upload, save e hydrate está acoplada dentro do modal (568 linhas).

### Solução: Tela Dedicada de Edição estilo Meta

Inspirado nos screenshots do Instagram/Facebook:
- Tela full-screen dedicada (não modal) com header fixo "Editar perfil" + botão voltar
- Avatar centralizado grande com botão "Editar foto ou avatar" abaixo
- Campos em lista vertical limpa (floating label style), um por linha
- Seções colapsáveis (Accordion): Dados Pessoais, Dados Profissionais, Endereço, Contato de Emergência, Zona de Perigo
- Botão "Salvar" fixo no bottom

### Mudanças Planejadas

**1. Criar `src/hooks/useProfileManager.ts`**
- Extrair TODA a lógica do `UserProfileModal` para um hook dedicado
- Estado do perfil, hydrate do banco, save, upload de foto, delete de foto, delete de conta
- Retorna: `profileData`, `addressData`, `isLoading`, `isSaving`, `photoUploading`, `handleSave`, `handlePhotoChange`, `handleRemovePhoto`, `handleDeleteAccount`, `handleFieldChange`, `handleAddressChange`, `missingFields`, `currentPhotoPath`

**2. Criar `src/pages/ProfileEdit.tsx`**
- Tela full-screen (rota `/profile/edit`)
- Header fixo com seta voltar + "Editar perfil" + botão Salvar
- Avatar grande centralizado com camera overlay e link "Editar foto"
- Campos organizados em seções com Accordion
- Seção por role (Produtor, Motorista, Prestador, Transportadora)
- Zona de perigo no final
- Safe area padding para iOS

**3. Atualizar `UserProfileModal.tsx`**
- Simplificar para modo somente visualização
- Botão "Editar Perfil" navega para `/profile/edit` (fecha modal)
- Remove toda lógica de edição inline (usa o hook para dados read-only)

**4. Adicionar rota em `App.tsx`**
- `/profile/edit` → `ProfileEdit` (protegida por auth)

**5. Atualizar componentes de profile/**
- `ProfileHeader` será reutilizado no modo view do modal
- Novos componentes inline no `ProfileEdit` para os campos estilo Meta

### Detalhes Técnicos

- O hook `useProfileManager` centraliza: `hydrateProfileFromDatabase`, `handleSave` (com `.select()` para verificação), `handlePhotoChange` (relative path, não signed URL), `handleRemovePhoto`, rating distribution fetch
- Upload de foto usa `useSignedImageUrl` para resolver paths privados
- Campos read-only (CPF/CNPJ, RNTRC) exibidos com lock icon
- Validação de completude no hook (missingFields)
- `react-router-dom` `useNavigate` para ir para edição e voltar

